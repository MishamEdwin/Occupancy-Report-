import React, { useState, useMemo, useEffect, useRef } from 'react';
import xl_data from '/src/data/xl_data.json';

function Body() {
    const [data, setData] = useState([]);
    const [selectedOccupancy, setSelectedOccupancy] = useState('All');
    
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

    // 2. Main logic for Subtotals when "All" is selected
    const filteredData = useMemo(() => {
        // Step A: Apply basic filters
        const baseFiltered = processedData.filter(row => {
            const matchesOccupancy = selectedOccupancy === 'All' || row.OccupancyName === selectedOccupancy;
            const matchesColumnFilters = Object.keys(columnFilters).every(key => {
                if (columnFilters[key] === 'Select') return true;
                return String(row[key]) === columnFilters[key];
            });
            return matchesOccupancy && matchesColumnFilters;
        });

        // Step B: If "All" is selected, group by segment and add subtotals
        if (selectedOccupancy === 'All') {
            const groups = {};
            baseFiltered.forEach(row => {
                if (!groups[row.Segments]) groups[row.Segments] = [];
                groups[row.Segments].push(row);
            });

            const resultWithSubtotals = [];
            Object.keys(groups).forEach(segment => {
                const rows = groups[segment];
                resultWithSubtotals.push(...rows);

                // Calculate Totals
                const totalNOP = rows.reduce((sum, r) => sum + r.NOP, 0);
                const totalGWP = rows.reduce((sum, r) => sum + r.GWP, 0);
                const totalGIC = rows.reduce((sum, r) => sum + r.GIC, 0);
                const totalGEP = rows.reduce((sum, r) => sum + r.GEP, 0);
                const totalNOC = rows.reduce((sum, r) => sum + r.NOC, 0);
                const totalSI = rows.reduce((sum, r) => sum + r.deltaRiskSI, 0);

                resultWithSubtotals.push({
                    id: `total-${segment}`,
                    Segments: `${segment} Total`,
                    isSummary: true,
                    NOP: totalNOP,
                    GWP: totalGWP,
                    GIC: totalGIC,
                    GEP: totalGEP,
                    NOC: totalNOC,
                    GicOverGep: totalGEP === 0 ? 0 : (totalGIC / totalGEP),
                    AvgRate: totalSI === 0 ? 0 : (totalGWP / totalSI) * 1000
                });
            });
            return resultWithSubtotals;
        }

        return baseFiltered;
    }, [processedData, selectedOccupancy, columnFilters]);

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
                        {selectedOccupancy === 'All' ? 'All (Summarized)' : selectedOccupancy}
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
                                {filteredOccupancyOptions.map(opt => (
                                    <div 
                                        key={opt} 
                                        className={`dropdown-item ${selectedOccupancy === opt ? 'active' : ''} ${opt === 'All' ? 'all-option' : ''}`}
                                        onClick={() => {
                                            setSelectedOccupancy(opt);
                                            setIsDropdownOpen(false);
                                            setOccupancySearch('');
                                        }}
                                    >
                                        {opt}
                                    </div>
                                ))}
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
