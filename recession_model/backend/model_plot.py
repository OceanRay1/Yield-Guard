import pandas as pd
import matplotlib.pyplot as plt

print("--- PLOTTING HISTORICAL RECESSION PROBABILITY TIMELINE ---")

# 1. Load the exported timeline data
df_timeline = pd.read_csv("historical_recession_probabilities_timeline.csv", index_col=0, parse_dates=True)

# 2. Set up the plotting canvas
plt.figure(figsize=(14, 7))

# Plot each model's probability curve
for col in df_timeline.columns:
    if col != 'Actual_Recession_Flag':
        plt.plot(df_timeline.index, df_timeline[col], label=col, linewidth=2)

# If actual recession flags exist, shade the official recession blocks for context
if 'Actual_Recession_Flag' in df_timeline.columns:
    # Highlight periods where target is 1
    recessions = df_timeline['Actual_Recession_Flag'] == 1
    plt.fill_between(df_timeline.index, 0, 100, where=recessions, color='red', alpha=0.15, label='True Crisis Window')

plt.title("Eco-Forecast: Macroeconomic Recession Probability Timeline", fontsize=14, fontweight='bold')
plt.xlabel("Year", fontsize=12)
plt.ylabel("Assigned Recession Probability (%)", fontsize=12)
plt.ylim(-5, 105)
plt.legend(loc="upper left")
plt.grid(True, linestyle="--", alpha=0.5)
plt.tight_layout()

# Save and show chart
output_plot = "recession_probability_timeline.png"
plt.savefig(output_plot)
print(f"\n[Success] Chart successfully generated and saved to: {output_plot}")
plt.show()