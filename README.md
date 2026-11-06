# melodyyangds.github.io

My portfolio site: **https://melodyyangds.github.io**

It has case studies from my work in data analytics, BI, business systems, and process improvement, plus 5 interactive dashboards you can click through.

## What's inside

| Path | What it is |
|---|---|
| `index.html` | Homepage: dashboards, case studies, skills, contact |
| `dataviz/request-demand.html` | Monthly request demand across 4 teams |
| `dataviz/access-governance.html` | Controlled-access program metrics across 3 sites |
| `dataviz/rework-spc.html` | Green Belt project: P-chart, I-chart, before and after Pareto |
| `dataviz/inventory-adoption.html` | Survey, impact vs effort matrix, and adoption trend |
| `dataviz/pm-cal-compliance.html` | Maintenance and calibration tracking |
| `dataviz/viz.js` | The small chart library behind all 5 dashboards |

## How it's built

Plain HTML, CSS, and JavaScript. No frameworks or chart libraries; every chart is drawn in SVG by `viz.js`. Each dashboard has filters, hover tooltips, a data table, a CSV download, and the SQL behind the view (BigQuery syntax).

## About the data

All dashboard data is synthetic. The layout, filters, and logic follow dashboards and analyses I built at work, but the numbers are generated in the browser, so no company data is included. Real results are only in the "Real outcome" notes, and they match my resume.
