import React from 'react';

const PrintableHeatSheet = ({ meetName, meetDate, eventsToPrint }) => {
  if (!meetName || !eventsToPrint || eventsToPrint.length === 0) {
    return <div className="printable-container" style={{ display: 'none' }}></div>;
  }

  return (
    <div className="printable-container">
      <style>{`
        /* --- Screen Styles (Hides component on screen) --- */
        @media screen {
          .printable-container {
            display: none;
          }
        }

        /* --- NEW: Professional Print Styles --- */
        @media print {
          /* --- Page and Body Setup --- */
          @page {
            size: A4;
            margin: 0.7in; /* Standard margins */
          }

          * {
            box-sizing: border-box; /* More predictable layout model */
          }

          body {
            font-family: 'Helvetica Neue', Arial, sans-serif; /* Clean, modern font */
            font-size: 9.5pt; /* Base font size for print */
            color: #333; /* Softer than pure black */
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            margin: 0;
          }
          
          /* --- Hiding/Showing Logic --- */
          body * {
            visibility: hidden;
          }
          .printable-container, .printable-container * {
            visibility: visible;
          }
          .printable-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }

          /* --- Header Styling --- */
          .heat-sheet-header {
            text-align: center;
            margin-bottom: 1.5rem; /* More space below header */
            border-bottom: 2px solid #ccc; /* Stronger separator */
            padding-bottom: 1rem;
          }
          .heat-sheet-header h1 {
            font-size: 20pt;
            font-weight: 600;
            margin: 0;
          }
          .heat-sheet-header p {
            font-size: 11pt;
            color: #555;
            margin: 0.25rem 0 0;
          }

          /* --- Main Content Layout --- */
          .heat-sheet-content {
            column-count: 2; /* Two-column layout */
            column-gap: 2.5rem; /* More space between columns */
          }

          /* --- Event Block Styling --- */
          .event-block {
            break-inside: avoid; /* Prevents events from splitting across columns/pages */
            margin-bottom: 1.25rem;
            border: 1px solid #ddd; /* Softer border */
            border-radius: 6px; /* Slightly rounded corners */
            padding: 0.75rem;
            background-color: #fff;
          }

          .event-title {
            font-size: 13pt;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #000;
            background-color: #f4f4f4; /* Light gray background */
            padding: 0.5rem 0.75rem;
            margin: -0.75rem -0.75rem 0.75rem -0.75rem; /* Extend to edges of the block */
            border-bottom: 1px solid #ddd;
            border-radius: 6px 6px 0 0; /* Match parent border-radius */
          }

          .heat-title {
            font-weight: 600;
            font-size: 10pt;
            margin-top: 1rem;
            margin-bottom: 0.5rem;
            color: #444;
          }
          
          /* --- Table Styling --- */
          .swimmer-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9pt; /* Slightly smaller for table data */
          }

          .swimmer-table th, .swimmer-table td {
            text-align: left;
            padding: 6px 4px; /* More vertical padding */
          }

          .swimmer-table th {
            font-weight: 700;
            color: #000;
            border-bottom: 1.5px solid #999; /* Stronger header underline */
          }
          
          /* Zebra-striping for readability */
          .swimmer-table tbody tr:nth-child(odd) td {
            background-color: #f9f9f9;
          }

          /* Column Widths */
          .swimmer-table .lane { width: 9%; font-weight: 600; }
          .swimmer-table .name { width: 46%; }
          .swimmer-table .age-team { width: 25%; font-size: 8.5pt; color: #555; }
          .swimmer-table .seed { width: 20%; text-align: right; font-family: 'Courier New', monospace; }
        }
      `}</style>

      <div className="heat-sheet-header">
        <h1>{meetName} - Heat Sheet</h1>
        <p>{meetDate}</p>
      </div>

      <div className="heat-sheet-content">
        {eventsToPrint.map(event => (
          <div key={event.id} className="event-block">
            <div className="event-title">
              #{event.eventNumber} {event.name}
            </div>
            {(event.heats && event.heats.length > 0) ? event.heats.map(heat => (
              <div key={heat.heatNumber}>
                <div className="heat-title">Heat {heat.heatNumber} of {event.heats.length}</div>
                <table className="swimmer-table">
                  <thead>
                    <tr>
                      <th className="lane">Lane</th>
                      <th className="name">Name</th>
                      <th className="age-team">Team</th>
                      <th className="seed">Seed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {heat.lanes.sort((a,b) => a.lane - b.lane).map(lane => (
                      <tr key={lane.id}>
                        <td className="lane">{lane.lane}</td>
                        <td className="name">{`${lane.lastName}, ${lane.firstName}`}</td>
                        <td className="age-team">{lane.age} {lane.team}</td>
                        <td className="seed">{lane.seedTime || 'NT'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )) : <p>No entries for this event.</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PrintableHeatSheet;