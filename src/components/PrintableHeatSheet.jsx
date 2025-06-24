import React, { forwardRef } from 'react';

// Using forwardRef to allow the parent component to get a DOM reference
const PrintableHeatSheet = forwardRef(({ meetData }, ref) => {
  if (!meetData || !meetData.events || meetData.events.length === 0) {
    return null;
  }

  return (
    // This entire component is hidden from the screen and only visible for printing
    <div ref={ref} className="printable-container">
      <style>{`
        @media screen {
          .printable-container {
            display: none;
          }
        }
        @media print {
          @page {
            size: A4;
            margin: 0.75in;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .heat-sheet-header {
            text-align: center;
            margin-bottom: 24px;
          }
          .heat-sheet-content {
            column-count: 2;
            column-gap: 2rem;
          }
          .event-block {
            break-inside: avoid;
            margin-bottom: 1rem;
            border: 1px solid #ccc;
            padding: 0.5rem;
            border-radius: 4px;
          }
          .event-title {
            font-weight: bold;
            font-size: 1.1em;
            margin-bottom: 0.25rem;
            background-color: #eee;
            padding: 0.25rem;
            border-radius: 2px;
          }
          .heat-title {
            font-weight: bold;
            margin-top: 0.5rem;
            padding-left: 0.25rem;
          }
          .swimmer-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.9em;
          }
          .swimmer-table th, .swimmer-table td {
            text-align: left;
            padding: 2px 4px;
          }
          .swimmer-table th {
            border-bottom: 1px solid #999;
          }
          .swimmer-table .lane { width: 10%; }
          .swimmer-table .name { width: 45%; }
          .swimmer-table .age-team { width: 25%; }
          .swimmer-table .seed { width: 20%; text-align: right; }
        }
      `}</style>

      <div className="heat-sheet-header">
        <h1>{meetData.name} - Heat Sheet</h1>
        <p>{new Date(meetData.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className="heat-sheet-content">
        {meetData.events.map(event => (
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
                      <th className="age-team">Age Team</th>
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
});

export default PrintableHeatSheet;
