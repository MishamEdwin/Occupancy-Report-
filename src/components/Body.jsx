import React, { useState, useMemo, useEffect, useRef } from 'react';
import xl_data from '/src/data/xl_data.json';

function Body() {
    const [data, setData] = useState([]);
    const [selectedOccupancies, setSelectedOccupancies] = useState(['All']);
    
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [occupancySearch, setOccupancySearch] = useState('');
    const dropdownRef = useRef(null);

    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    
    // 1. Default changed from 'All' to 'Select'
    const [columnFilters, setColumnFilters] = useState({
        Segments: 'Select', NOP: 'Select', GWP: 'Select', GIC: 'Select', GEP: 'Select', GicOverGep: 'Select', NOC: 'Select', AvgRate: 'Select'
    });
    
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);

    useEffect(() => {
        setData(Array.isArray(xl_data) ? xl_data : []);
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const parseNumber = (val) => {
        if (val === null || val === undefined) return 0;
        if (typeof val === 'number') return val;
        const s = String(val).trim();
        if (s === '' || s === '(None)' || s === '-') return 0;
        let negative = s.startsWith('(') && s.endsWith(')');
        let cleaned = negative ? s.slice(1, -1) : s;
        cleaned = cleaned.replace(/,/g, '').replace(/%/g, '');
        const n = parseFloat(cleaned);
        return isNaN(n) ? 0 : (negative ? -n : n);
    };

    const fmtNum = (n) => {
        if (n === null || n === undefined || Number.isNaN(n)) return '-';
        return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-';
    };

    const processedData = useMemo(() => {
        return data.map((row, index) => {
            const GWP = parseNumber(row['Prem']);
            const NOP = parseNumber(row['Net Pol']);
            const GIC = parseNumber(row['Claim incurred in period']);
            const GEP = parseNumber(row['Earned Prem']);
            const NOC = parseNumber(row['Num claim registered']);
            const deltaRiskSI = parseNumber(row['Delta risk SI']);
            return {
                id: index,
                Segments: row['UW Sub Channel'] || '(None)',
                OccupancyName: row['GC Occupancies Name'] || '(None)',
                NOP, GWP, GIC, GEP, NOC, deltaRiskSI,
                GicOverGep: GEP === 0 ? 0 : (GIC / GEP),
                AvgRate: deltaRiskSI === 0 ? 0 : (GWP / deltaRiskSI) * 1000, // Fixed multiplier
                isSummary: false
            };
        });
    }, [data]);

    const occupancyOptions = useMemo(() => {
        const uniqueValues = new Set(processedData.map(item => String(item.OccupancyName)));
        return ['All', ...Array.from(uniqueValues).sort((a, b) => a.localeCompare(b))];
    }, [processedData]);

    const filteredOccupancyOptions = occupancyOptions.filter(opt =>
        opt.toLowerCase().includes(occupancySearch.toLowerCase())
    );

    // 2. Main logic for grouping by segment - one row per segment with summed values
    const filteredData = useMemo(() => {
        // Step A: Apply occupancy filter
        const baseFiltered = selectedOccupancies.includes('All')
            ? processedData
            : processedData.filter(row => selectedOccupancies.includes(row.OccupancyName));

        // Step B: Apply column filters
        const columnFiltered = baseFiltered.filter(row => {
            return Object.keys(columnFilters).every(key => {
                if (columnFilters[key] === 'Select') return true;
                return String(row[key]) === columnFilters[key];
            });
        });

        // Step C: Group by segment and sum all values
        const groups = {};
        columnFiltered.forEach(row => {
            if (!groups[row.Segments]) {
                groups[row.Segments] = {
                    id: row.Segments,
                    Segments: row.Segments,
                    NOP: 0,
                    GWP: 0,
                    GIC: 0,
                    GEP: 0,
                    NOC: 0,
                    deltaRiskSI: 0,
                    isSummary: false
                };
            }
            groups[row.Segments].NOP += row.NOP;
            groups[row.Segments].GWP += row.GWP;
            groups[row.Segments].GIC += row.GIC;
            groups[row.Segments].GEP += row.GEP;
            groups[row.Segments].NOC += row.NOC;
            groups[row.Segments].deltaRiskSI += row.deltaRiskSI;
        });

        // Step D: Calculate GIC/GEP and AvgRate for each segment
        const result = Object.keys(groups).sort().map(segment => {
            const group = groups[segment];
            return {
                ...group,
                GicOverGep: group.GEP === 0 ? 0 : (group.GIC / group.GEP),
                AvgRate: group.deltaRiskSI === 0 ? 0 : (group.GWP / group.deltaRiskSI) * 1000
            };
        });

        return result;
    }, [processedData, selectedOccupancies, columnFilters]);

    const sortedData = useMemo(() => {
        let sortableItems = [...filteredData];
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                // Keep summaries at the bottom of their respective segments during sort
                if (a.isSummary && b.isSummary) return 0;
                if (a.isSummary) return 1; 
                if (b.isSummary) return -1;

                if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
                if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [filteredData, sortConfig]);

    const totalPages = Math.ceil(sortedData.length / itemsPerPage);
    const paginatedData = useMemo(() => {
        const firstPageIndex = (currentPage - 1) * itemsPerPage;
        return sortedData.slice(firstPageIndex, firstPageIndex + itemsPerPage);
    }, [sortedData, currentPage, itemsPerPage]);

    const tableKeys = ['Segments', 'NOP', 'GWP', 'GIC', 'GEP', 'GicOverGep', 'NOC', 'AvgRate'];

    return (
        <div className="dashboard-container">
            <div className="filter-section">
                <label className="filter-label">Occupancy:</label>
                <div className="custom-dropdown" ref={dropdownRef}>
                    <div className="dropdown-selected" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
                        {selectedOccupancies.length === 0 ? 'Select...' : selectedOccupancies.length === occupancyOptions.length ? 'All Selected' : `${selectedOccupancies.length} selected`}
                        <span className="arrow">{isDropdownOpen ? '▲' : '▼'}</span>
                    </div>
                    {isDropdownOpen && (
                        <div className="dropdown-menu">
                            <input 
                                type="text" 
                                className="dropdown-search" 
                                placeholder="Search occupancy..." 
                                value={occupancySearch}
                                onChange={(e) => setOccupancySearch(e.target.value)}
                                autoFocus
                            />
                            <div className="dropdown-options">
                                {filteredOccupancyOptions.map(opt => {
                                    const isSelected = selectedOccupancies.includes(opt);
                                    return (
                                        <div 
                                            key={opt} 
                                            className={`dropdown-item ${isSelected ? 'active' : ''} ${opt === 'All' ? 'all-option' : ''}`}
                                            onClick={() => {
                                                if (opt === 'All') {
                                                    setSelectedOccupancies(isSelected ? [] : ['All']);
                                                } else {
                                                    let updated;
                                                    if (isSelected) {
                                                        updated = selectedOccupancies.filter(item => item !== opt && item !== 'All');
                                                    } else {
                                                        updated = selectedOccupancies.filter(item => item !== 'All');
                                                        updated.push(opt);
                                                    }
                                                    setSelectedOccupancies(updated.length === 0 ? ['All'] : updated);
                                                }
                                            }}
                                        >
                                            <input type="checkbox" checked={isSelected} readOnly style={{ marginRight: 8 }} />
                                            {opt}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th className="sl-col">Sl. No</th>
                            {tableKeys.map(key => (
                                <th key={key}>
                                    <div className="header-content">
                                        <div className="sort-label" onClick={() => setSortConfig({key, direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'})}>
                                            {key === 'GicOverGep' ? 'GIC/GEP' : key === 'AvgRate' ? 'Avg Rate' : key}
                                            <span>{sortConfig.key === key ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                                        </div>
                                        <select 
                                            className="column-filter-select"
                                            value={columnFilters[key]} 
                                            onChange={(e) => setColumnFilters(prev => ({ ...prev, [key]: e.target.value }))}
                                        >
                                            <option value="Select">Select</option>
                                            {Array.from(new Set(processedData.map(i => String(i[key])))).sort().map(v => (
                                                <option key={v} value={v}>{v}</option>
                                            ))}
                                        </select>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedData.map((row, idx) => (
                            <tr key={row.id} className={row.isSummary ? 'summary-row' : ''}>
                                <td className="sl-col">
                                    {row.isSummary ? '' : (currentPage - 1) * itemsPerPage + idx + 1}
                                </td>
                                <td className={row.isSummary ? 'summary-text' : 'segment-cell'}>{row.Segments}</td>
                                <td className="num-cell">{fmtNum(row.NOP)}</td>
                                <td className="num-cell">{fmtNum(row.GWP)}</td>
                                <td className={`num-cell ${row.GIC < 0 ? 'negative-val' : ''}`}>{fmtNum(row.GIC)}</td>
                                <td className="num-cell">{fmtNum(row.GEP)}</td>
                                <td className="num-cell">{fmtNum(row.GicOverGep)}</td>
                                <td className="num-cell">{fmtNum(row.NOC)}</td>
                                <td className="num-cell">{fmtNum(row.AvgRate)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="pagination-container">
                <div className="range-selector">
                    <label>Show </label>
                    <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} className="pagination-select">
                        {[50, 100, 200].map(size => <option key={size} value={size}>{size}</option>)}
                    </select>
                    <span> records</span>
                </div>
                <div className="page-navigation">
                    <button className="pagination-btn" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>Previous</button>
                    <span>Page {currentPage} of {totalPages || 1}</span>
                    <button className="pagination-btn" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages || totalPages === 0}>Next</button>
                </div>
            </div>
        </div>
    );
}

export default Body;
