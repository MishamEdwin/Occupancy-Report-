import React, { useState, useMemo, useEffect, useRef } from 'react';
import xl_data from '/src/data/xl_data.json';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

function Body() {
    const [data, setData] = useState([]);
    const [selectedOccupancyCombined, setSelectedOccupancyCombined] = useState(['All']);
    const [isCombinedDropdownOpen, setIsCombinedDropdownOpen] = useState(false);
    const [combinedSearch, setCombinedSearch] = useState('');
    const combinedDropdownRef = useRef(null);
    const [isFinDropdownOpen, setIsFinDropdownOpen] = useState(false);
    const [isFromDropdownOpen, setIsFromDropdownOpen] = useState(false);
    const [isToDropdownOpen, setIsToDropdownOpen] = useState(false);
    const [finSearch, setFinSearch] = useState('');
    const [fromSearch, setFromSearch] = useState('');
    const [toSearch, setToSearch] = useState('');
    const finDropdownRef = useRef(null);
    const fromDropdownRef = useRef(null);
    const toDropdownRef = useRef(null);

    const [globalSort, setGlobalSort] = useState({ key: null, dir: 'asc' });
    const [activeFilter, setActiveFilter] = useState({ metric: null, value: null });
    const [filterMode, setFilterMode] = useState('horizontal'); 
    const [showModeCloud, setShowModeCloud] = useState(false); // State for the cloud popup

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);
    const [selectedFinYear, setSelectedFinYear] = useState(null);
    const [fromMonth, setFromMonth] = useState(null);
    const [toMonth, setToMonth] = useState(null);

    const [visibleColumns, setVisibleColumns] = useState({
        Segments: true, NOP: true, GWP: true, GIC: true, GEP: true, GicOverGep: true, NOC: true,
        AvgRate: true
    });

    const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
    const [openColumnFilterKey, setOpenColumnFilterKey] = useState(null);
    const columnFilterRefs = useRef({});

    useEffect(() => {
        setData(Array.isArray(xl_data) ? xl_data : []);
        const handleClickOutside = (event) => {
            if (combinedDropdownRef.current && !combinedDropdownRef.current.contains(event.target))
                setIsCombinedDropdownOpen(false);
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
            const GWP = parseNumber(row['GWP']);
            const NOP = parseNumber(row['NOP']);
            const GIC = parseNumber(row['GIC']);
            const GEP = parseNumber(row['GEP']);
            const NOC = parseNumber(row['NOC']);
            const actSI = parseNumber(row['Act SI']);
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
                NOP, GWP, GIC, GEP, NOC, actSI,
                GicOverGep: GEP === 0 ? 0 : (GIC / GEP),
                AvgRate: actSI === 0 ? 0 : (GWP / actSI) * 1000,
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
            GEP: 0, NOC: 0, actSI: 0
        });
        yearFiltered.forEach(row => {
            if (groups[row.Segments]) {
                groups[row.Segments].NOP += row.NOP; groups[row.Segments].GWP += row.GWP;
                groups[row.Segments].GIC += row.GIC; groups[row.Segments].GEP += row.GEP;
                groups[row.Segments].NOC += row.NOC; groups[row.Segments].actSI +=
                    row.actSI;
            }
        });
        return Object.values(groups).map(g => ({
            ...g, GicOverGep: g.GEP === 0 ? 0 : (g.GIC / g.GEP),
            AvgRate: g.actSI === 0 ? 0 : (g.GWP / g.actSI) * 1000
        }));
    };

    const unifiedTableData = useMemo(() => {
        const years = [selectedFinYear, ...previousTwoYears].filter(Boolean);
        if (years.length === 0) return { years: [], dataByYear: {}, sortedSegments: [] };

        const rawDataByYear = {};
        years.forEach(year => {
            rawDataByYear[year] = getYearlyData(year);
        });

        const referenceYear = years[0];
        const referenceData = rawDataByYear[referenceYear] || [];

        let filteredSegments = activeSegments;
        let filteredMetrics = ['NOP', 'GWP', 'GIC', 'GEP', 'GicOverGep', 'NOC', 'AvgRate'];

        if (activeFilter.metric && activeFilter.value !== null) {
            if (filterMode === 'horizontal') {
                const matchingSegments = referenceData
                    .filter(row => fmtNum(row[activeFilter.metric]) === activeFilter.value)
                    .map(row => row.Segments);
                filteredSegments = activeSegments.filter(seg => matchingSegments.includes(seg));
            } else if (filterMode === 'vertical') {
                filteredMetrics = [activeFilter.metric];
            }
        }

        let sortedSegments = filteredSegments;
        if (globalSort.key) {
            const valueMap = {};
            referenceData.forEach(row => valueMap[row.Segments] = row[globalSort.key] ?? 0);
            sortedSegments = filteredSegments.slice().sort((a, b) => {
                const av = valueMap[a] ?? 0;
                const bv = valueMap[b] ?? 0;
                return globalSort.dir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
            });
        }

        const dataByYear = {};
        years.forEach(year => {
            const items = rawDataByYear[year];
            dataByYear[year] = sortedSegments.map(seg => {
                const found = items.find(r => r.Segments === seg);
                return found || { Segments: seg, NOP: 0, GWP: 0, GIC: 0, GEP: 0, NOC: 0, actSI: 0, GicOverGep: 0, AvgRate: 0 };
            });
        });

        return { years, dataByYear, sortedSegments, filteredMetrics };
    }, [selectedFinYear, previousTwoYears, monthsInDisplayRange,
        selectedOccupancyCombined, activeSegments, activeFilter, filterMode, globalSort]);

    const toggleColumn = (key) => setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));

    const metrics = ['NOP', 'GWP', 'GIC', 'GEP', 'GicOverGep', 'NOC', 'AvgRate'];
    const visibleMetrics = filterMode === 'vertical' && activeFilter.metric
        ? unifiedTableData.filteredMetrics
        : metrics.filter(m => visibleColumns[m]);

    const paginatedSegments = useMemo(() => {
        return (unifiedTableData.sortedSegments || []).slice(
            (currentPage - 1) * itemsPerPage,
            currentPage * itemsPerPage
        );
    }, [unifiedTableData.sortedSegments, currentPage, itemsPerPage]);

    const chartDataByMetric = useMemo(() => {
        const result = {};
        metrics.forEach(metric => {
            result[metric] = paginatedSegments.map(seg => {
                const entry = { name: seg };
                unifiedTableData.years.forEach(year => {
                    const row = unifiedTableData.dataByYear[year]?.find(r => r.Segments === seg);
                    entry[year] = row ? row[metric] : 0;
                });
                return entry;
            });
        });
        return result;
    }, [paginatedSegments, unifiedTableData, metrics]);

    const yearColors = ['#1e40af', '#0d9488', '#7c3aed'];

    // Handle Mode Toggle with Cloud effect
    const handleModeToggle = () => {
        setFilterMode(prev => prev === 'horizontal' ? 'vertical' : 'horizontal');
        setShowModeCloud(true);
        setTimeout(() => setShowModeCloud(false), 2000);
    };

    return (
        <div className="dashboard-container">
            <div className="filter-section">
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label className="filter-label">FINANCIAL YEAR:</label>
                    <div className="custom-dropdown" ref={finDropdownRef}>
                        <div className="dropdown-selected" onClick={() => setIsFinDropdownOpen(!isFinDropdownOpen)}>
                            {selectedFinYear || 'Select...'} <span className="arrow">{isFinDropdownOpen ? '▲' : '▼'}</span>
                        </div>
                        {isFinDropdownOpen && (
                            <div className="dropdown-menu">
                                <input type="text" className="dropdown-search" placeholder="Search..." value={finSearch} onChange={e => setFinSearch(e.target.value)} autoFocus />
                                <div className="dropdown-options">
                                    {financialYears.filter(fy => fy.toLowerCase().includes(finSearch.toLowerCase())).map(fy => (
                                        <div key={fy} className={`dropdown-item ${selectedFinYear === fy ? 'active' : ''}`} onClick={() => { setSelectedFinYear(fy); setIsFinDropdownOpen(false); }}>{fy}</div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label className="filter-label">FROM MONTH:</label>
                    <div className="custom-dropdown" ref={fromDropdownRef}>
                        <div className="dropdown-selected" onClick={() => setIsFromDropdownOpen(!isFromDropdownOpen)}>
                            {fromMonth ? monthNames[fromMonth - 1] : 'Select...'} <span className="arrow">{isFromDropdownOpen ? '▲' : '▼'}</span>
                        </div>
                        {isFromDropdownOpen && (
                            <div className="dropdown-menu">
                                <input type="text" className="dropdown-search" placeholder="Search..." value={fromSearch} onChange={e => setFromSearch(e.target.value)} />
                                <div className="dropdown-options">
                                    {finOrderMonths.map(m => (
                                        <div key={m} className={`dropdown-item ${fromMonth === m ? 'active' : ''}`} onClick={() => { setFromMonth(m); setIsFromDropdownOpen(false); }}>{monthNames[m - 1]}</div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label className="filter-label">TO MONTH:</label>
                    <div className="custom-dropdown" ref={toDropdownRef}>
                        <div className="dropdown-selected" onClick={() => setIsToDropdownOpen(!isToDropdownOpen)}>
                            {toMonth ? monthNames[toMonth - 1] : 'Select...'} <span className="arrow">{isToDropdownOpen ? '▲' : '▼'}</span>
                        </div>
                        {isToDropdownOpen && (
                            <div className="dropdown-menu">
                                <input type="text" className="dropdown-search" placeholder="Search..." value={toSearch} onChange={e => setToSearch(e.target.value)} />
                                <div className="dropdown-options">
                                    {finOrderMonths.map(m => {
                                        const isDisabled = finOrderMonths.indexOf(m) < finOrderMonths.indexOf(fromMonth);
                                        return <div key={m} className={`dropdown-item ${toMonth === m ? 'active' : ''}${isDisabled ? 'disabled' : ''}`} onClick={() => !isDisabled && (setToMonth(m), setIsToDropdownOpen(false))}>{monthNames[m - 1]}</div>
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label className="filter-label">OCCUPANCY:</label>
                    <div className="custom-dropdown" ref={combinedDropdownRef}>
                        <div className="dropdown-selected" onClick={() => setIsCombinedDropdownOpen(!isCombinedDropdownOpen)}>
                            {selectedOccupancyCombined.includes('All') ? 'All Selected' : `${selectedOccupancyCombined.length} selected`}
                            <span className="arrow">{isCombinedDropdownOpen ? '▲' : '▼'}</span>
                        </div>
                        {isCombinedDropdownOpen && (
                            <div className="dropdown-menu">
                                <input type="text" className="dropdown-search" placeholder="Search..." value={combinedSearch} onChange={e => setCombinedSearch(e.target.value)} />
                                <div className="dropdown-options">
                                    {combinedOccupancyOptions.filter(opt => opt.toLowerCase().includes(combinedSearch.toLowerCase())).map(opt => (
                                        <div key={opt} className={`dropdown-item ${selectedOccupancyCombined.includes(opt) ? 'active' : ''}`}
                                            onClick={() => {
                                                if (opt === 'All') setSelectedOccupancyCombined(['All']);
                                                else {
                                                    const filtered = selectedOccupancyCombined.filter(x => x !== 'All');
                                                    setSelectedOccupancyCombined(selectedOccupancyCombined.includes(opt) ? filtered.filter(x => x !== opt) : [...filtered, opt]);
                                                }
                                            }}>
                                            <input type="checkbox" checked={selectedOccupancyCombined.includes(opt)} readOnly /> {opt}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="table-header-container">
                <button className="pagination-btn" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={() => setIsCustomizerOpen(!isCustomizerOpen)}>
                    {isCustomizerOpen ? 'Hide Metrics' : 'Customize Metrics'}
                </button>

                <div className="mode-toggle-container">
                    {showModeCloud && (
                        <div className="mode-cloud">
                            Mode: <strong>{filterMode.toUpperCase()}</strong>
                        </div>
                    )}
                    <button className="icon-button" title="Toggle Filter Mode" onClick={handleModeToggle}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 3v18M3 12h18" style={{ transform: filterMode === 'vertical' ? 'rotate(90deg)' : 'none', transformOrigin: 'center', transition: '0.3s' }} />
                            <polyline points="16 16 20 12 16 8" />
                            <polyline points="8 8 4 12 8 16" />
                        </svg>
                    </button>
                </div>
            </div>

            {isCustomizerOpen && (
                <div className="column-customizer" style={{ marginTop: '0', marginBottom: '15px' }}>
                    <div className="column-list">
                        {metrics.map(key => (
                            <div key={key} className="column-item" onClick={() => toggleColumn(key)}>
                                <input type="checkbox" checked={visibleColumns[key]} readOnly />
                                <label>{key === 'GicOverGep' ? 'GIC/GEP' : key === 'AvgRate' ? 'Avg Rate' : key}</label>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th rowSpan={2} className="sticky-segment">Metrics</th>
                            {unifiedTableData.years.map((year, idx) => (
                                <th key={year} colSpan={paginatedSegments.length} style={{
                                    backgroundColor: idx === 0 ? '#1e40af' : idx === 1 ? '#0d9488' : '#7c3aed'
                                }}>
                                    {year}
                                </th>
                            ))}
                        </tr>
                        <tr>
                            {unifiedTableData.years.flatMap((year) =>
                                paginatedSegments.map((seg) => (
                                    <th key={`${year}-${seg}`} style={{ fontSize: '10px', minWidth: '110px' }}>
                                        {seg}
                                    </th>
                                ))
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {visibleMetrics.map((metric) => (
                            <tr key={metric}>
                                <td className="sticky-segment">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span onClick={() => {
                                            const dir = globalSort.key === metric && globalSort.dir === 'asc' ? 'desc' : 'asc';
                                            setGlobalSort({ key: metric, dir });
                                        }} style={{ cursor: 'pointer' }}>
                                            {metric === 'GicOverGep' ? 'GIC/GEP' : metric === 'AvgRate' ? 'Avg Rate' : metric}
                                            {globalSort.key === metric ? (globalSort.dir === 'asc' ? ' ▲' : ' ▼') : ' ↕'}
                                        </span>
                                        <div style={{ position: 'relative' }} ref={el => columnFilterRefs.current[`global-${metric}`] = el}>
                                            <button className="filter-icon-btn" onClick={() => setOpenColumnFilterKey(openColumnFilterKey?.id === `global-${metric}` ? null : { id: `global-${metric}`, metric })}>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 4h18l-6 8v8l-6 4V12L3 4z" /></svg>
                                            </button>
                                            {openColumnFilterKey?.id === `global-${metric}` && (
                                                <div className="dropdown-menu" style={{ position: 'absolute', right: 0, width: '180px', top: '100%', backgroundColor: 'white' }}>
                                                    <div className="dropdown-item" onClick={() => { setActiveFilter({ metric: null, value: null }); setOpenColumnFilterKey(null); }}>Clear Filter</div>
                                                    <div className="dropdown-options" style={{ maxHeight: '200px' }}>
                                                        {[...new Set(getYearlyData(unifiedTableData.years[0] || selectedFinYear).map(r => fmtNum(r[metric])))].sort((a, b) => parseNumber(a) - parseNumber(b)).map(opt => (
                                                            <div key={opt} className="dropdown-item" onClick={() => { setActiveFilter({ metric, value: opt }); setOpenColumnFilterKey(null); }}>{opt}</div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                {unifiedTableData.years.flatMap((year, yearIdx) => {
                                    const bgTint = yearIdx === 0 ? 'rgba(30, 64, 175, 0.02)' : yearIdx === 1 ? 'rgba(13, 148, 136, 0.02)' : 'rgba(124, 58, 237, 0.02)';
                                    return paginatedSegments.map((seg) => {
                                        const rowData = unifiedTableData.dataByYear[year]?.find(r => r.Segments === seg) || {};
                                        return (
                                            <td key={`${year}-${seg}-${metric}`} className="num-cell" style={{ backgroundColor: bgTint }}>
                                                {fmtNum(rowData[metric])}
                                            </td>
                                        );
                                    });
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="line-representation-section" style={{ marginTop: '40px' }}>
                <h3 style={{ textAlign: 'center', color: '#1e40af', marginBottom: '30px', fontWeight: 'bold' }}>Metric Comparison Across Segments</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
                    {metrics.map((metric) => (
                        <div key={metric} style={{ background: '#fff', padding: '15px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', height: '320px' }}>
                            <h4 style={{ textAlign: 'center', marginBottom: '10px', fontSize: '14px', color: '#334155' }}>{metric === 'GicOverGep' ? 'GIC/GEP' : metric === 'AvgRate' ? 'AVG RATE' : metric}</h4>
                            <div style={{ flex: 1, width: '100%', height: '240px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartDataByMetric[metric]}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} height={60} fontSize={9} />
                                        <YAxis fontSize={10} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                                        <Tooltip formatter={(value) => fmtNum(value)} />
                                        <Legend verticalAlign="top" iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                                        {unifiedTableData.years.map((year, yIdx) => (
                                            <Line key={year} type="monotone" dataKey={year} stroke={yearColors[yIdx % yearColors.length]} strokeWidth={2} dot={{ r: 3 }} />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="pagination-container">
                <select value={itemsPerPage} onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="pagination-select">
                    {[10, 20, 50, 100].map(s => <option key={s} value={s}>Show {s} Fields</option>)}
                </select>
                <div className="page-navigation">
                    <button className="pagination-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</button>
                    <span style={{ margin: '0 15px', fontWeight: '600' }}>Page {currentPage} of {Math.ceil((unifiedTableData.sortedSegments?.length || 0) / itemsPerPage)}</span>
                    <button className="pagination-btn" onClick={() => setCurrentPage(p => Math.min(Math.ceil((unifiedTableData.sortedSegments?.length || 0) / itemsPerPage), p + 1))} disabled={currentPage >= Math.ceil((unifiedTableData.sortedSegments?.length || 0) / itemsPerPage)}>Next</button>
                </div>
            </div>
        </div>
    );
}

export default Body;
