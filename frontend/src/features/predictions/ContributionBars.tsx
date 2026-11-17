import type { FeatureContribution } from "@/types/support";
import { featureLabel } from "./featureLabels";

function formatValue(contribution: FeatureContribution) {
  if (contribution.value === null) return "no data (model default)";
  if (Number.isInteger(contribution.value)) return String(contribution.value);
  return contribution.value.toFixed(1);
}

export function ContributionBars({
  contributions,
}: {
  contributions: FeatureContribution[];
}) {
  if (!contributions?.length) return null;
  const max = Math.max(...contributions.map((c) => Math.abs(c.contribution)), 1e-9);
  const shown = contributions.slice(0, 6);
  return (
    <div className="contrib-block" aria-label="Feature contributions">
      <h3>What moved this prediction</h3>
      <p className="body-copy">
        Each factor&apos;s push on the risk probability. Right and up means
        higher risk; left and down means lower risk.
      </p>
      <ul className="contrib-list">
        {shown.map((item) => {
          const width = Math.max((Math.abs(item.contribution) / max) * 50, 1.5);
          const raises = item.contribution > 0;
          return (
            <li key={item.name} className="contrib-row">
              <span className="contrib-label">
                {featureLabel(item.name)}
                <span className="contrib-value">{formatValue(item)}</span>
              </span>
              <span
                className="contrib-track"
                role="img"
                aria-label={`${raises ? "increases" : "decreases"} risk by ${Math.abs(
                  item.contribution,
                ).toFixed(2)}`}
              >
                <span
                  className={`contrib-fill ${raises ? "raises" : "lowers"}`}
                  style={
                    raises
                      ? { left: "50%", width: `${width}%` }
                      : { right: "50%", width: `${width}%` }
                  }
                />
              </span>
              <span
                className={`contrib-amount ${raises ? "raises" : "lowers"}`}
              >
                {raises ? "+" : "−"}
                {Math.abs(item.contribution).toFixed(2)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
