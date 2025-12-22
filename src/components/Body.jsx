import React, { useState, useMemo, useEffect, useRef } from 'react';
import xl_data from '/src/data/xl_data.json';

function Body() {
    const [data, setData] = useState([]);
    // Occupancy selection   
    const [selectedOccupancyCombined, setSelectedOccupancyCombined] = useState(['All']);
    const [isCombinedDropdownOpen, setIsCombinedDropdownOpen] = useState(false);
    const [combinedSearch, setCombinedSearch] = useState('');
    const combinedDropdownRef = useRef(null);
    // Period dropdowns   
    const [isFinDropdownOpen, setIsFinDropdownOpen] = useState(false);
    const [isFromDropdownOpen, setIsFromDropdownOpen] = useState(false);
    const [isToDropdownOpen, setIsToDropdownOpen] = useState(false);
    const [finSearch, setFinSearch] = useState('');
    const [fromSearch, setFromSearch] = useState('');
    const [toSearch, setToSearch] = useState('');
    const finDropdownRef = useRef(null);
    const fromDropdownRef = useRef(null);
    const toDropdownRef = useRef(null);

    // Independent filter states for each year block, but GLOBAL sort
    const [tableConfigs, setTableConfigs] = useState({});
    const [globalSort, setGlobalSort] = useState({ key: null, dir: 'asc' });

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);

    // Period states   
    const [selectedFinYear, setSelectedFinYear] = useState(null);
    const [fromMonth, setFromMonth] = useState(null);
    const [toMonth, setToMonth] = useState(null);

    // View mode   
    const [viewMode, setViewMode] = useState('aggregated');

    // Column visibility   
    const [visibleColumns, setVisibleColumns] = useState({
        Segments: true, NOP: true, GWP: true, GIC: true, GEP: true, GicOverGep: true, NOC: true,
        AvgRate: true
    });

    const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
    const [openColumnFilterKey, setOpenColumnFilterKey] = useState(null);
    const [columnFilterSearch, setColumnFilterSearch] = useState({});
    const columnFilterRefs = useRef({});

    useEffect(() => {
        setData(Array.isArray(xl_data) ? xl_data : []);
        const handleClickOutside = (event) => {
            if (combinedDropdownRef.current &&
                !combinedDropdownRef.current.contains(event.target)) setIsCombinedDropdownOpen(false);
            if (finDropdownRef.current && !finDropdownRef.current.contains(event.target))
                setIsFinDropdownOpen(false);
            if (fromDropdownRef.current && !fromDropdownRef.current.contains(event.target))
                setIsFromDropdownOpen(false);
            if (toDropdownRef.current && !toDropdownRef.current.contains(event.target))
                setIsToDropdownOpen(false);
            if (openColumnFilterKey) {
                const ref = columnFilterRefs.current[openColumnFilterKey.id];
                if (ref && !ref.contains(event.target)) setOpenColumnFilterKey(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [openColumnFilterKey]);

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

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
        'September', 'October', 'November', 'December'];
    const finOrderMonths = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];

    const processedData = useMemo(() => {
        return data.map((row, index) => {
            const GWP = parseNumber(row['Prem']);
            const NOP = parseNumber(row['Net Pol']);
            const GIC = parseNumber(row['Claim incurred in period']);
            const GEP = parseNumber(row['Earned Prem']);
            const NOC = parseNumber(row['Num claim registered']);
            const deltaRiskSI = parseNumber(row['Delta risk SI']);
            let monthNum = null; let finYear = null;
            const finRaw = row['Financial (GWP)'] || '';
            try {
                const parts = String(finRaw).split(',');
                if (parts.length >= 2) {
                    const m = parseInt(parts[0].trim(), 10);
                    const y = parts[1].trim();
                    if (!isNaN(m)) monthNum = m;
                    finYear = y || null;
                }
            } catch (e) { }
            const combinedLabel = `${row['GC Occupancies'] || '(None)'}-${row['GC Occupancies Name']
                || '(None)'}`;
            return {
                id: index,
                Segments: row['UW Sub Channel'] || row['UW sub channel'] || '(None)',
                OccupancyCombined: combinedLabel,
                NOP, GWP, GIC, GEP, NOC, deltaRiskSI,
                GicOverGep: GEP === 0 ? 0 : (GIC / GEP),
                AvgRate: deltaRiskSI === 0 ? 0 : (GWP / deltaRiskSI) * 1000,
                financialMonthNum: monthNum,
                financialYear: finYear,
            };
        });
    }, [data]);

    const financialYears = useMemo(() => {
        const set = new Set();
        processedData.forEach(item => item.financialYear && set.add(item.financialYear));
        return Array.from(set).sort((a, b) => parseInt(a.split('-')[0]) - parseInt(b.split('-')[0]));
    }, [processedData]);

    const previousTwoYears = useMemo(() => {
        if (!selectedFinYear) return [];
        const [startYear] = selectedFinYear.split('-').map(Number);
        return [`${startYear - 1}-${(startYear).toString().slice(-2)}`, `${startYear - 2}-${(startYear -
            1).toString().slice(-2)}`];
    }, [selectedFinYear]);

    useEffect(() => {
        if (financialYears.length > 0) {
            const latestFY = financialYears[financialYears.length - 1];
            setSelectedFinYear(prev => prev === null ? latestFY : prev);
            setFromMonth(prev => prev === null ? 4 : prev);
        }
    }, [financialYears]);

    const combinedOccupancyOptions = useMemo(() => {
        const set = new Set();
        processedData.forEach(item => item.OccupancyCombined &&
            set.add(item.OccupancyCombined));
        return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
    }, [processedData]);

    const monthsInDisplayRange = useMemo(() => {
        if (!fromMonth) return [];
        if (toMonth === null) return [fromMonth];
        const months = []; let started = false;
        for (const m of finOrderMonths) {
            if (m === fromMonth) started = true;
            if (started) months.push(m);
            if (m === toMonth) break;
        }
        return months;
    }, [fromMonth, toMonth]);

    const activeSegments = useMemo(() => {
        const filtered = selectedOccupancyCombined.includes('All')
            ? processedData
            : processedData.filter(row =>
                selectedOccupancyCombined.includes(row.OccupancyCombined));
        const set = new Set();
        filtered.forEach(row => set.add(row.Segments));
        return Array.from(set).sort();
    }, [processedData, selectedOccupancyCombined]);

    const getYearlyData = (year) => {
        const occupancyFiltered = selectedOccupancyCombined.includes('All')
            ? processedData : processedData.filter(row =>
                selectedOccupancyCombined.includes(row.OccupancyCombined));
        const targetMonths = monthsInDisplayRange;
        const yearFiltered = occupancyFiltered.filter(row => row.financialYear === year &&
            targetMonths.includes(row.financialMonthNum));
        const groups = {};
        activeSegments.forEach(seg => groups[seg] = {
            Segments: seg, NOP: 0, GWP: 0, GIC: 0,
            GEP: 0, NOC: 0, deltaRiskSI: 0
        });
        yearFiltered.forEach(row => {
            if (groups[row.Segments]) {
                groups[row.Segments].NOP += row.NOP; groups[row.Segments].GWP += row.GWP;
                groups[row.Segments].GIC += row.GIC; groups[row.Segments].GEP += row.GEP;
                groups[row.Segments].NOC += row.NOC; groups[row.Segments].deltaRiskSI +=
                    row.deltaRiskSI;
            }
        });
        return Object.values(groups).map(g => ({
            ...g, GicOverGep: g.GEP === 0 ? 0 : (g.GIC / g.GEP),
            AvgRate: g.deltaRiskSI === 0 ? 0 : (g.GWP / g.deltaRiskSI) * 1000
        }));
    };

    const unifiedTableData = useMemo(() => {
        const years = [selectedFinYear, ...previousTwoYears].filter(Boolean);
        const dataByYear = {};

        const rawDataByYear = {};
        years.forEach(year => {
            rawDataByYear[year] = getYearlyData(year);
        });

        let sortedSegments = activeSegments;
        if (globalSort.key) {
            const referenceYear = years[0];
            const referenceData = rawDataByYear[referenceYear] || [];
            const sortKey = globalSort.key;
            const dir = globalSort.dir;

            const valueMap = {};
            referenceData.forEach(row => {
                valueMap[row.Segments] = row[sortKey] ?? 0;
            });
            activeSegments.forEach(seg => {
                if (!(seg in valueMap)) valueMap[seg] = 0;
            });

            sortedSegments = activeSegments.slice().sort((a, b) => {
                const av = valueMap[a] ?? 0;
                const bv = valueMap[b] ?? 0;
                return dir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
            });
        }

        years.forEach(year => {
            let items = rawDataByYear[year];
            const config = tableConfigs[year] || { filters: {} };

            items = items.filter(row => Object.keys(config.filters).every(k =>
                config.filters[k] === 'Select' || String(row[k]) === String(config.filters[k])
            ));

            const orderedItems = [];
            sortedSegments.forEach(seg => {
                const row = items.find(r => r.Segments === seg);
                if (row) orderedItems.push(row);
            });

            dataByYear[year] = orderedItems;
        });

        return { years, dataByYear, sortedSegments };
    }, [selectedFinYear, previousTwoYears, monthsInDisplayRange,
        selectedOccupancyCombined, tableConfigs, activeSegments, globalSort]);

    const updateTableConfig = (year, key, value, type) => {
        if (type === 'sort') {
            const dir = globalSort.key === key && globalSort.dir === 'asc' ? 'desc' : 'asc';
            setGlobalSort({ key, dir });
        } else {
            setTableConfigs(prev => {
                const current = prev[year] || { filters: {} };
                return { ...prev, [year]: { ...current, filters: { ...current.filters, [key]: value } } };
            });
        }
    };

    const toggleColumn = (key) => setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));

    const metrics = ['NOP', 'GWP', 'GIC', 'GEP', 'GicOverGep', 'NOC', 'AvgRate'];
    const visibleMetrics = metrics.filter(m => visibleColumns[m]);

    return (
        <div className="dashboard-container">
            {/* Filters Section */}
            <div className="filter-section">
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label className="filter-label">FINANCIAL YEAR:</label>
                    <div className="custom-dropdown" ref={finDropdownRef}>
                        <div className="dropdown-selected" onClick={() =>
                            setIsFinDropdownOpen(!isFinDropdownOpen)}>
                            {selectedFinYear || 'Select...'} <span className="arrow">{isFinDropdownOpen ? '▲' :
                                '▼'}</span>
                        </div>
                        {isFinDropdownOpen && (
                            <div className="dropdown-menu">
                                <input type="text" className="dropdown-search" placeholder="Search..."
                                    value={finSearch} onChange={e => setFinSearch(e.target.value)} autoFocus />
                                <div className="dropdown-options">
                                    {financialYears.filter(fy =>
                                        fy.toLowerCase().includes(finSearch.toLowerCase())).map(fy => (
                                            <div key={fy} className={`dropdown-item ${selectedFinYear === fy ? 'active' :
                                                ''}`}
                                                onClick={() => {
                                                    setSelectedFinYear(fy); setIsFinDropdownOpen(false);
                                                }}>{fy}</div>
                                        ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label className="filter-label">FROM MONTH:</label>
                    <div className="custom-dropdown" ref={fromDropdownRef}>
                        <div className="dropdown-selected" onClick={() =>
                            setIsFromDropdownOpen(!isFromDropdownOpen)}>
                            {fromMonth ? monthNames[fromMonth - 1] : 'Select...'} <span
                                className="arrow">{isFromDropdownOpen ? '▲' : '▼'}</span>
                        </div>
                        {isFromDropdownOpen && (
                            <div className="dropdown-menu">
                                <input type="text" className="dropdown-search" placeholder="Search..."
                                    value={fromSearch} onChange={e => setFromSearch(e.target.value)} />
                                <div className="dropdown-options">
                                    {finOrderMonths.map(m => (
                                        <div key={m} className={`dropdown-item ${fromMonth === m ? 'active' : ''}`}
                                            onClick={() => { setFromMonth(m); setIsFromDropdownOpen(false); }}>{monthNames[m - 1]}</div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label className="filter-label">TO MONTH:</label>
                    <div className="custom-dropdown" ref={toDropdownRef}>
                        <div className="dropdown-selected" onClick={() =>
                            setIsToDropdownOpen(!isToDropdownOpen)}>
                            {toMonth ? monthNames[toMonth - 1] : 'Select...'} <span
                                className="arrow">{isToDropdownOpen ? '▲' : '▼'}</span>
                        </div>
                        {isToDropdownOpen && (
                            <div className="dropdown-menu">
                                <input type="text" className="dropdown-search" placeholder="Search..."
                                    value={toSearch} onChange={e => setToSearch(e.target.value)} />
                                <div className="dropdown-options">
                                    {finOrderMonths.map(m => {
                                        const isDisabled = finOrderMonths.indexOf(m) <
                                            finOrderMonths.indexOf(fromMonth);
                                        return <div key={m} className={`dropdown-item ${toMonth === m ? 'active' : ''} 
${isDisabled ? 'disabled' : ''}`} onClick={() => !isDisabled && (setToMonth(m),
                                                setIsToDropdownOpen(false))}>{monthNames[m - 1]}</div>
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label className="filter-label">OCCUPANCY:</label>
                    <div className="custom-dropdown" ref={combinedDropdownRef}>
                        <div className="dropdown-selected" onClick={() =>
                            setIsCombinedDropdownOpen(!isCombinedDropdownOpen)}>
                            {selectedOccupancyCombined.includes('All') ? 'All Selected' :
                                `${selectedOccupancyCombined.length} selected`}
                            <span className="arrow">{isCombinedDropdownOpen ? '▲' : '▼'}</span>
                        </div>
                        {isCombinedDropdownOpen && (
                            <div className="dropdown-menu">
                                <input type="text" className="dropdown-search" placeholder="Search..."
                                    value={combinedSearch} onChange={e => setCombinedSearch(e.target.value)} />
                                <div className="dropdown-options">
                                    {combinedOccupancyOptions.filter(opt =>
                                        opt.toLowerCase().includes(combinedSearch.toLowerCase())).map(opt => (
                                            <div key={opt} className={`dropdown-item 
${selectedOccupancyCombined.includes(opt) ? 'active' : ''}`}
                                                onClick={() => {
                                                    if (opt === 'All') setSelectedOccupancyCombined(['All']);
                                                    else {
                                                        const filtered = selectedOccupancyCombined.filter(x => x !== 'All');

                                                        setSelectedOccupancyCombined(selectedOccupancyCombined.includes(opt) ? filtered.filter(x => x !==
                                                            opt) : [...filtered, opt]);
                                                    }
                                                }}>
                                                <input type="checkbox"
                                                    checked={selectedOccupancyCombined.includes(opt)} readOnly /> {opt}
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <button className="pagination-btn" onClick={() =>
                    setIsCustomizerOpen(!isCustomizerOpen)}>
                    {isCustomizerOpen ? 'Hide Customize Columns' : 'Customize Table Columns'}
                </button>
            </div>

            {isCustomizerOpen && (
                <div className="column-customizer">
                    <div className="column-list">
                        {metrics.map(key => (
                            <div key={key} className="column-item" onClick={() => toggleColumn(key)}>
                                <input type="checkbox" checked={visibleColumns[key]} readOnly />
                                <label>{key === 'GicOverGep' ? 'GIC/GEP' : key === 'AvgRate' ? 'Avg Rate' :
                                    key}</label>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="table-wrapper">
                <table className="data-table">
                    <thead>
                        {/* Row 1: Year Headers */}
                        <tr>
                            <th rowSpan={3} className="sticky-segment">Segments</th>
                            {unifiedTableData.years.map((year, idx) => (
                                <th key={year} colSpan={visibleMetrics.length} style={{
                                    backgroundColor: idx === 0 ? '#1e40af' : idx === 1 ? '#0d9488' : '#7c3aed',
                                    color: 'white'
                                }}>
                                    {year}
                                </th>
                            ))}
                        </tr>
                        {/* Row 2: Metric Sort & Filter */}
                        <tr>
                            {unifiedTableData.years.flatMap((year, yearIdx) => visibleMetrics.map(metric => (
                                <th key={`${year}-${metric}`} className="sub-header">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span onClick={() => updateTableConfig(year, metric, null, 'sort')} style={{
                                            cursor: 'pointer'
                                        }}>
                                            {metric === 'GicOverGep' ? 'GIC/GEP' : metric === 'AvgRate' ? 'Avg Rate' :
                                                metric}
                                            {globalSort.key === metric ? (globalSort.dir ===
                                                'asc' ? ' ▲' : ' ▼') : ' ↕'}
                                        </span>
                                        <div ref={el => columnFilterRefs.current[`${year}-${metric}`] = el}>
                                            <button className="filter-icon-btn" onClick={() =>
                                                setOpenColumnFilterKey(openColumnFilterKey?.id === `${year}-${metric}` ? null : {
                                                    id: `${year}-${metric}`, year, metric
                                                })}>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M3 4h18l-6 8v8l-6 4V12L3 4z"/>
                                                </svg>
                                            </button>
                                            {openColumnFilterKey?.id === `${year}-${metric}` && (
                                                <div className="dropdown-menu" style={{
                                                    width: '200px', fontWeight: 'normal', textTransform: 'none'
                                                }}>
                                                    <div className="dropdown-item" onClick={() => {
                                                        updateTableConfig(year, metric, 'Select', 'filter'); setOpenColumnFilterKey(null);
                                                    }}>Clear</div>
                                                    <div className="dropdown-options" style={{ maxHeight: '200px' }}>
                                                        {[...new Set(getYearlyData(year).map(r =>
                                                            String(r[metric])))].sort().map(opt => (
                                                                <div key={opt} className="dropdown-item" onClick={() => {
                                                                    updateTableConfig(year, metric, opt, 'filter'); setOpenColumnFilterKey(null);
                                                                }}>{opt}</div>
                                                            ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </th>
                            )))}
                        </tr>
                    </thead>
                    <tbody>
                        {unifiedTableData.sortedSegments?.slice((currentPage - 1) * itemsPerPage, currentPage *
                            itemsPerPage).map((seg) => (
                                <tr key={seg}>
                                    <td className="sticky-segment">{seg}</td>
                                    {unifiedTableData.years.flatMap((year, yearIdx) => {
                                        const rowData = unifiedTableData.dataByYear[year]?.find(r => r.Segments === seg)
                                            || {};
                                        const bgTint = yearIdx === 0 ? 'rgba(30, 64, 175, 0.06)' :
                                                      yearIdx === 1 ? 'rgba(13, 148, 136, 0.06)' :
                                                      'rgba(124, 58, 237, 0.06)';
                                        return visibleMetrics.map(metric => (
                                            <td key={`${year}-${seg}-${metric}`} className={`num-cell ${metric ===
                                                'GicOverGep' ? 'ratio-cell' : ''}`}
                                                style={{ backgroundColor: bgTint }}>
                                                {metric === 'Segments' ? (rowData[metric] || '-') : fmtNum(rowData[metric])}
                                            </td>
                                        ));
                                    })}
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>

            <div className="pagination-container">
                <select value={itemsPerPage} onChange={e => setItemsPerPage(Number(e.target.value))}
                    className="pagination-select">
                    {[50, 100, 200].map(s => <option key={s} value={s}>Show {s}</option>)}
                </select>
                <div className="page-navigation">
                    <button className="pagination-btn" onClick={() => setCurrentPage(p => Math.max(1, p -
                        1))} disabled={currentPage === 1}>Prev</button>
                    <span>Page {currentPage} of {Math.ceil((unifiedTableData.sortedSegments?.length || 0) / itemsPerPage)}</span>
                    <button className="pagination-btn" onClick={() => setCurrentPage(p =>
                        Math.min(Math.ceil((unifiedTableData.sortedSegments?.length || 0) / itemsPerPage), p + 1))} disabled={currentPage >=
                            Math.ceil((unifiedTableData.sortedSegments?.length || 0) / itemsPerPage)}>Next</button>
                </div>
            </div>
        </div>
    );
}

export default Body;
