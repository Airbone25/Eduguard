# Spring School: eight-week testing history

These are synthetic school records for the same ten Spring School students, SPR001–SPR010, in Grade 10-A Mathematics (academic year 2026).

Seven earlier weeks, **17 August–28 September 2026**, supplement the current week starting **5 October 2026**. The existing current-week records are preserved. The enrollment dates are moved to 17 August to allow historical entries. There is no need to re-import the student list.

## Files

- The seven `weekly_records_YYYY-MM-DD.csv` files use the teacher weekly-entry format. Choose the Monday matching the filename and Grade 10-A Mathematics before uploading a file.
- `admin_history_70_records.csv` combines the same seven weeks into one admin weekly-record import. It includes the additional `subject_code` and `week_start` columns required by that importer. Select Mathematics as the course.

The files contain identical history in two import formats. Use one method, not both. They are supplied for inspection or repeating the test setup; all 70 historical rows have already been loaded directly into Spring School. Reimporting existing weeks replaces those weeks' raw measurements, including setting omitted fields to missing.

Verified on 7 October 2026: all ten students have eight weeks of records, existing weekly values were preserved, and ten assessments were saved using the pretrained model. The dashboard reports 2 Priority support, 8 Doing well, and 0 Not assessed. The measured trajectories are 3 declining, 3 improving, and 4 stable.

## Scenarios

| Students | Sample pattern to inspect |
|---|---|
| Aarav Sharma, Diya Singh, Isha Nair | Consistently strong or stable history |
| Ananya Patel, Vivaan Gupta, Kabir Das | Declining scores or attendance, with repeated late submissions |
| Arjun Mehta, Meera Rao | Improving scores and attendance |
| Rohan Verma | Alternating high and low scores, suitable for inspecting volatility |
| Sara Khan | Mostly stable, with an unknown assessment average on 31 August; missing measurements remain blank |

All columns are raw school observations. No prediction labels, probabilities, derived slopes, or other ML features are supplied as inputs. The existing pretrained model determines support levels; the sample scenarios do not guarantee a particular model classification.

## What to test after refreshing the dashboard

1. Check the class support levels and trajectories after assessments are generated.
2. Open individual students to see multiweek charts, measured signals, and recommendations where applicable.
3. Create an intervention from a recommendation, make it active, and add a private follow-up note.
4. Sign in as that student to check their progress and any student-visible intervention.

Strong or stable students may have no warning signal. An intervention appears only after you explicitly create a support plan. No interventions are created by the history load.
