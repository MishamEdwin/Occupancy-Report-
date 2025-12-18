import React, { useState, useMemo } from 'react';

const dummy_data = [
    {
        "UW Sub Channel": "(None)",
        "GC Occupancies": "(None)",
        "Sum of Prem": 0,
        "Sum of Net Pol": 0,
        "Sum of Num claims registered": 0,
        "Sum of Earned Prem": 80241,
        "Sum of Claim incurred in period": -86966,
        "Sum of Delta risk SI": "(None)"
    },
    {
        "UW Sub Channel": "(None)",
        "GC Occupancies": 101,
        "Sum of Prem": 0,
        "Sum of Net Pol": 0,
        "Sum of Num claims registered": 0,
        "Sum of Earned Prem": 97968,
        "Sum of Claim incurred in period": 0,
        "Sum of Delta risk SI": "(None)"
    },
    {
        "UW Sub Channel": "(None)",
        "GC Occupancies": 7505,
        "Sum of Prem": 0,
        "Sum of Net Pol": 0,
        "Sum of Num claims registered": 0,
        "Sum of Earned Prem": 1147,
        "Sum of Claim incurred in period": 0,
        "Sum of Delta risk SI": "(None)"
    },
    {
        "UW Sub Channel": "Banca PSU",
        "GC Occupancies": "(None)",
        "Sum of Prem": 0,
        "Sum of Net Pol": 0,
        "Sum of Num claims registered": 0,
        "Sum of Earned Prem": 0,
        "Sum of Claim incurred in period": 8000,
        "Sum of Delta risk SI": 0
    },
    {
        "UW Sub Channel": "Banca PSU",
        "GC Occupancies": 100,
        "Sum of Prem": 70744,
        "Sum of Net Pol": 14,
        "Sum of Num claims registered": 0,
        "Sum of Earned Prem": 297595,
        "Sum of Claim incurred in period": 0,
        "Sum of Delta risk SI": 307992111
    },
    {
        "UW Sub Channel": "Banca PSU",
        "GC Occupancies": 10005,
        "Sum of Prem": 0,
        "Sum of Net Pol": 0,
        "Sum of Num claims registered": 0,
        "Sum of Earned Prem": 55203,
        "Sum of Claim incurred in period": 1661380,
        "Sum of Delta risk SI": 0
    },
    {
        "UW Sub Channel": "Banca PSU",
        "GC Occupancies": 1006,
        "Sum of Prem": 1130,
        "Sum of Net Pol": 1,
        "Sum of Num claims registered": 0,
        "Sum of Earned Prem": 5951,
        "Sum of Claim incurred in period": 0,
        "Sum of Delta risk SI": 1200000
    },

];

function Body() {
    // occupancy filter state
    const [selectedOccupancy, setSelectedOccupancy] = useState('All');

    // build list of unique occupancy codes (strings) from data; stable order
    const occupancyOptions = useMemo(() => {
        if (!Array.isArray(dummy_data) || dummy_data.length === 0) return [];
        const set = new Set();
        dummy_data.forEach(r => {
            // convert undefined/null to explicit string so the dropdown can show it
            const val = r['GC Occupancies'] === undefined || r['GC Occupancies'] === null
                ? '(None)'
                : String(r['GC Occupancies']);
            set.add(val);
        });
        return ['All', ...Array.from(set)];
    }, []);

   // target headers you requested — added serial number as first column
    const headers = ['Sl. No', 'NOP', 'GWP', 'GIC', 'GEP', 'GIC/GEP', 'NOC', 'Avg Rate'];

    // robust parser to handle "(None)", comma thousands, parentheses for negatives, strings etc.
    const parseNumber = (val) => {
        if (val === null || val === undefined) return 0;
        if (typeof val === 'number') return val;
        const s = String(val).trim();
        if (s === '' || s === '(None)' || s === '-' ) return 0;
        // handle parentheses like "(86,966)" as negative
        let negative = false;
        let cleaned = s;
        if (/^\(.+\)$/.test(cleaned)) {
            negative = true;
            cleaned = cleaned.slice(1, -1);
        }
        cleaned = cleaned.replace(/,/g, '').replace(/%/g, '');
        const n = parseFloat(cleaned);
        if (isNaN(n)) return 0;
        return negative ? -n : n;
    };

    const fmtNum = (n, opts = {}) => {
        if (n === null || n === undefined || n === '-' || Number.isNaN(n)) return '-';
        if (opts.percent) return (n).toFixed(2) + '%';
        // show integers without decimals when they're whole numbers
        return Number.isFinite(n) ? n.toLocaleString() : '-';
    };

    // filtered rows according to selected occupancy
    const filteredData = useMemo(() => {
        if (selectedOccupancy === 'All') return dummy_data;
        return dummy_data.filter(row => {
            const val = row['GC Occupancies'] === undefined || row['GC Occupancies'] === null
                ? '(None)'
                : String(row['GC Occupancies']);
            return val === selectedOccupancy;
        });
    }, [selectedOccupancy]);

    return (
        <div className="table-container">
            <div style={{ marginBottom: 12 }}>
                <label htmlFor="occupancy-select" style={{ marginRight: 8 }}>Occupancies:</label>
                <select
                    id="occupancy-select"
                    value={selectedOccupancy}
                    onChange={(e) => setSelectedOccupancy(e.target.value)}
                    disabled={occupancyOptions.length === 0}
                >
                    {occupancyOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
            </div>

            <table className="data-table">
                <thead>
                    <tr>
                        {headers.map(h => (
                            <th key={h}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {filteredData.map((row, idx) => {
                        const GWP = parseNumber(row['Sum of Prem']);
                        const NOP = parseNumber(row['Sum of Net Pol']);
                        const GIC = parseNumber(row['Sum of Claim incurred in period']);
                        const GEP = parseNumber(row['Sum of Earned Prem']);
                        const NOC = parseNumber(row['Sum of Num claims registered']);
                        const deltaRiskSI = parseNumber(row['Sum of Delta risk SI']);
                        // Terror Premium may be absent in some datasets -> treat as 0
                        const terrorPremium = parseNumber(row['Terror Premium'] ?? 0);

                        // calculations
                        const gicOverGep = (GEP === 0) ? null : (GIC / GEP) * 100; // percent
                        const avgRate = (deltaRiskSI === 0) ? null : ((GWP - terrorPremium) / deltaRiskSI) * 100;

                        return (
                            <tr key={idx}>
                                <td>{idx + 1}</td>
                                <td>{fmtNum(NOP)}</td>
                                <td>{fmtNum(GWP)}</td>
                                <td>{fmtNum(GIC)}</td>
                                <td>{fmtNum(GEP)}</td>
                                <td>{gicOverGep === null ? '-' : fmtNum(gicOverGep, { percent: true })}</td>
                                <td>{fmtNum(NOC)}</td>
                                <td>{avgRate === null ? '-' : fmtNum(avgRate, { percent: true })}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

export default Body;
