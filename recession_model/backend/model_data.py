import requests
import pandas as pd
import numpy as np
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

today = datetime.today()
start_date = '1970-01-01'
end_date = today.strftime('%Y-%m-%d')

print(f"Fetching FRED data dynamically from {start_date} to {end_date}...")

api_key = os.getenv('FRED_API_KEY') 
base_url = 'https://api.stlouisfed.org/fred/series/observations'

series_ids = {
    'GS10': '10Y Treasury Rate', 'GS2': '2Y Treasury Rate', 'TB3MS': '3M Treasury Bill Rate', 'FEDFUNDS': 'Federal Funds Rate',
    'CFNAI': 'Chicago Fed National Activity Index', 'M2SL': 'M2 Money Supply',
    'TOTALSL': 'Total Consumer Credit', 'NONREVSL': 'Nonrevolving Consumer Credit', 'BUSLOANS': 'Commercial and Industrial Loans',
    'UNRATE': 'Unemployment Rate', 'PAYEMS': 'Total Nonfarm Payrolls', 'RPI': 'Real Personal Income', 'AWOTMAN': 'Manufacturing Overtime Hours',
    'INDPRO': 'Industrial Production', 'IPMAN': 'Manufacturing Production', 'TCU': 'Capacity Utilization', 'WTISPLC': 'WTI Oil Price',
    'PPIACO': 'Producer Price Index: All Commodities', 'HOUST': 'Housing Starts', 'PERMIT': 'New Building Permits',
    'UMCSENT': 'Consumer Sentiment', 'CPIAUCSL': 'Consumer Price Index', 'PCEPI': 'PCE Price Index', 'USREC': 'Recession Flag'
}

dataframes = {}
for s_id in series_ids.keys():
    params = {
        'series_id': s_id,
        'observation_start': start_date,
        'observation_end': end_date,
        'file_type': 'json',
        'api_key': api_key,
    }
    response = requests.get(base_url, params=params)
    res = response.json()

    if 'observations' in res:
        obs = res['observations']
        df = pd.DataFrame(obs)[['date', 'value']]
        df['date'] = pd.to_datetime(df['date'])
        # Clean non-numeric values returned as '.' by FRED
        df['value'] = pd.to_numeric(df['value'], errors='coerce')
        df.set_index('date', inplace=True)
        dataframes[s_id] = df['value']
    else:
        print(f'Failed to fetch {s_id}: {res}')

raw_df = pd.DataFrame(dataframes)
monthly_df = raw_df.resample('MS').ffill()

# 1. Feature Engineering
monthly_df['SPREAD_10Y3M'] = monthly_df['GS10'] - monthly_df['TB3MS']
monthly_df['SPREAD_10Y2Y'] = monthly_df['GS10'] - monthly_df['GS2']
monthly_df['FED_FUNDS_CHANGE'] = monthly_df['FEDFUNDS'].diff(12)

monthly_df['PAYROLL_YOY'] = monthly_df['PAYEMS'].pct_change(12)
monthly_df['INCOME_YOY'] = monthly_df['RPI'].pct_change(12)
monthly_df['OVERTIME_YOY'] = monthly_df['AWOTMAN'].pct_change(12)

monthly_df['INDPRO_YOY'] = monthly_df['INDPRO'].pct_change(12)
monthly_df['MANUF_YOY'] = monthly_df['IPMAN'].pct_change(12)
monthly_df['TCU_CHANGE'] = monthly_df['TCU'] - monthly_df['TCU'].rolling(12).max()
monthly_df['OIL_YOY'] = monthly_df['WTISPLC'].pct_change(12)
monthly_df['PPI_YOY'] = monthly_df['PPIACO'].pct_change(12)

monthly_df['HOUSING_YOY'] = monthly_df['HOUST'].pct_change(12)
monthly_df['PERMIT_YOY'] = monthly_df['PERMIT'].pct_change(12)

monthly_df['CFNAI_MA3'] = monthly_df['CFNAI'].rolling(3).mean()
monthly_df['M2_GROWTH_YOY'] = monthly_df['M2SL'].pct_change(12)
monthly_df['CREDIT_GROWTH_YOY'] = monthly_df['TOTALSL'].pct_change(12)
monthly_df['NONREV_GROWTH_YOY'] = monthly_df['NONREVSL'].pct_change(12)
monthly_df['BUS_LOAN_YOY'] = monthly_df['BUSLOANS'].pct_change(12)
monthly_df['CPI_YOY'] = monthly_df['CPIAUCSL'].pct_change(12)
monthly_df['PCE_YOY'] = monthly_df['PCEPI'].pct_change(12)
monthly_df['SENTIMENT_YOY'] = monthly_df['UMCSENT'].pct_change(12)

# Alternate Macro Indicators 
monthly_df['MONETARY_VELOCITY'] = monthly_df['FED_FUNDS_CHANGE'] * monthly_df['M2_GROWTH_YOY']
monthly_df['HOUSING_MOMENTUM_INFLECTION'] = monthly_df['HOUSING_YOY'] - monthly_df['HOUSING_YOY'].shift(3)
monthly_df['SPREAD_INVERSION_MAGNITUDE'] = np.where(monthly_df['SPREAD_10Y3M'] < 0, monthly_df['SPREAD_10Y3M'] ** 2, 0)
monthly_df['CREDIT_CRUNCH_INTERACTION'] = monthly_df['SPREAD_10Y3M'] * monthly_df['CREDIT_GROWTH_YOY']
monthly_df['PAYROLL_ACCELERATION'] = monthly_df['PAYROLL_YOY'].diff(3)
monthly_df['INDPRO_ACCELERATION'] = monthly_df['INDPRO_YOY'].diff(3)
monthly_df['LIQUIDITY_PRESSURE'] = monthly_df['FED_FUNDS_CHANGE'] - monthly_df['M2_GROWTH_YOY']
monthly_df['TCU_PEAK_DISTANCE'] = monthly_df['TCU'] - monthly_df['TCU'].rolling(36).max()
monthly_df['CONSUMER_DIVERGENCE'] = monthly_df['SENTIMENT_YOY'] - monthly_df['INCOME_YOY']
monthly_df['REAL_FED_FUNDS'] = monthly_df['FEDFUNDS'] - monthly_df['CPI_YOY']
monthly_df['REAL_FED_FUNDS_ACCEL'] = monthly_df['REAL_FED_FUNDS'].diff(3)
monthly_df['CREDIT_ACCELERATION'] = monthly_df['CREDIT_GROWTH_YOY'].diff(3)
monthly_df['POLICY_OVERTIGHTENING'] = np.where((monthly_df['SPREAD_10Y3M'] < 0) & (monthly_df['REAL_FED_FUNDS'] > 4.0), 1, 0)

# Finalized 1970-Compatible (enough data 1970-now) Feature Pool
feature_cols = [
    'SPREAD_10Y3M', 'SPREAD_10Y2Y', 'FED_FUNDS_CHANGE', 'PAYROLL_YOY',
    'INCOME_YOY', 'OVERTIME_YOY', 'INDPRO_YOY', 'MANUF_YOY',
    'TCU_CHANGE', 'OIL_YOY', 'PPI_YOY', 'HOUSING_YOY', 'PERMIT_YOY',
    'CFNAI_MA3', 'M2_GROWTH_YOY', 'CREDIT_GROWTH_YOY',
    'NONREV_GROWTH_YOY', 'BUS_LOAN_YOY', 'CPI_YOY', 'PCE_YOY', 'SENTIMENT_YOY',
    'MONETARY_VELOCITY', 'HOUSING_MOMENTUM_INFLECTION',
    'SPREAD_INVERSION_MAGNITUDE', 'CREDIT_CRUNCH_INTERACTION',
    'PAYROLL_ACCELERATION', 'INDPRO_ACCELERATION',
    'LIQUIDITY_PRESSURE', 'TCU_PEAK_DISTANCE', 'CONSUMER_DIVERGENCE',
    'REAL_FED_FUNDS', 'REAL_FED_FUNDS_ACCEL', 
    'CREDIT_ACCELERATION', 'POLICY_OVERTIGHTENING'
]

# 2. CRITICAL Anti-leakage shift 
monthly_df[feature_cols] = monthly_df[feature_cols].shift(1)

# 3. Target definition 
future_recession = pd.concat(
    [monthly_df['USREC'].shift(-i) for i in range(1, 13)],
    axis=1
)
monthly_df['target_recession_12m'] = future_recession.max(axis=1)

monthly_df['YIELD_WARNING'] = np.where(
    monthly_df['SPREAD_10Y3M'] < 0.25,
    1,
    0
)

monthly_df['YIELD_INVERSION'] = (
    monthly_df['SPREAD_10Y3M'] < 0
).astype(int)

monthly_df['filter_target'] = np.where(
    (monthly_df['YIELD_WARNING'] == 1) & (monthly_df['target_recession_12m'] == 1),
    1,
    np.where(
        (monthly_df['YIELD_WARNING'] == 1) & (monthly_df['target_recession_12m'] == 0),
        0,
        np.nan
    )
)

cols_to_keep = list(set(
    feature_cols +
    [
        'YIELD_WARNING',
        'YIELD_INVERSION',
        'target_recession_12m',
        'filter_target'
    ]
))

final_df = monthly_df[cols_to_keep].dropna(subset=['filter_target'])
final_df['outcome'] = np.where(final_df['target_recession_12m'] == 1, 'RECESSION', 'NO RECESSION')

final_df.to_csv("yield_curve_filter_data.csv", index=True)

print("Yield Filter Dataset Processed Successfully")

output_df = final_df.reset_index()[['date', 'outcome']]
output_df.to_csv("yield_curve_filter_outcomes.csv", index=False)

# 4. New continous file for frontend (Fill all missing/blank values across the board with 0 for the UI)
monthly_df = monthly_df.fillna(0)

chart_df = monthly_df.reset_index()

chart_df.rename(columns={
    'date': 'displayDate',
    'USREC': 'recessionFlag'
}, inplace=True)

chart_df["filter_active"] = (chart_df["YIELD_WARNING"] == 1)

chart_df.to_csv("continuous_chart_data.csv", index=False)
print("Continuous chart data successfully updated up to:", chart_df['displayDate'].max())