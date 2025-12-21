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

    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    const [columnFilters, setColumnFilters] = useState({
        Segments: 'Select', NOP: 'Select', GWP: 'Select', GIC: 'Select', GEP: 'Select', GicOverGep: 'Select', NOC: 'Select', AvgRate: 'Select'
    });

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
        Segments: true,
        NOP: true,
        GWP: true,
        GIC: true,
        GEP: true,
        GicOverGep: true,
        NOC: true,
        AvgRate: true
    });

    // Customizer panel toggle
    const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);

    // Column filter UI
    const [openColumnFilterKey, setOpenColumnFilterKey] = useState(null);
    const [columnFilterSearch, setColumnFilterSearch] = useState({});
    const columnFilterRefs = useRef({});

    useEffect(() => {
        setData(Array.isArray(xl_data) ? xl_data : []);
        const handleClickOutside = (event) => {
            if (combinedDropdownRef.current && !combinedDropdownRef.current.contains(event.target)) setIsCombinedDropdownOpen(false);
            if (finDropdownRef.current && !finDropdownRef.current.contains(event.target)) setIsFinDropdownOpen(false);
            if (fromDropdownRef.current && !fromDropdownRef.current.contains(event.target)) setIsFromDropdownOpen(false);
            if (toDropdownRef.current && !toDropdownRef.current.contains(event.target)) setIsToDropdownOpen(false);
            if (openColumnFilterKey) {
                const ref = columnFilterRefs.current[openColumnFilterKey];
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

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const finOrderMonths = [4,5,6,7,8,9,10,11,12,1,2,3]; // April → March

    const processedData = useMemo(() => {
        return data.map((row, index) => {
            const GWP = parseNumber(row['Prem']);
            const NOP = parseNumber(row['Net Pol']);
            const GIC = parseNumber(row['Claim incurred in period']);
            const GEP = parseNumber(row['Earned Prem']);
            const NOC = parseNumber(row['Num claim registered']);
            const deltaRiskSI = parseNumber(row['Delta risk SI']);

            let monthNum = null;
            let finYear = null;

            const finRaw = row['Financial (GWP)'] || '';
            try {
                const parts = String(finRaw).split(',');
                if (parts.length >= 2) {
                    const m = parseInt(parts[0].trim(), 10);
                    const y = parts[1].trim();
                    if (!isNaN(m)) monthNum = m;
                    finYear = y || null;
                }
            } catch (e) {}

            const OccName = row['GC Occupancies Name'] || '(None)';
            const OccCode = row['GC Occupancies'] || '(None)';
            const combinedLabel = `${OccCode}-${OccName}`;

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

    useEffect(() => {
        if (financialYears.length > 0) {
            const latestFY = financialYears[financialYears.length - 1];
            setSelectedFinYear(prev => prev === null ? latestFY : prev);
            setFromMonth(prev => prev === null ? 4 : prev);
            setToMonth(null);
        }
        setCurrentPage(1);
    }, [financialYears]);

    const combinedOccupancyOptions = useMemo(() => {
        const set = new Set();
        processedData.forEach(item => item.OccupancyCombined && set.add(item.OccupancyCombined));
        return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
    }, [processedData]);

    // Period display with cross-year FY support
    const selectedPeriodDisplay = useMemo(() => {
        if (!selectedFinYear || fromMonth === null) return { type: 'all', label: 'All periods' };

        const fyStart = parseInt(selectedFinYear.split('-')[0], 10);
        const fromLabel = `${monthNames[fromMonth - 1]}, ${selectedFinYear}`;

        if (toMonth === null || toMonth === fromMonth) {
            return { type: 'single', from: fromLabel };
        }

        const toYear = toMonth <= 3 ? `${fyStart + 1}-${fyStart + 2}` : selectedFinYear;
        const toLabel = `${monthNames[toMonth - 1]}, ${toYear}`;

        return { type: 'range', from: fromLabel, to: toLabel };
    }, [selectedFinYear, fromMonth, toMonth]);

    // To Month dropdown shows all months
    const filteredToMonths = finOrderMonths;

    // Reset To Month if invalid after From change
    useEffect(() => {
        if (fromMonth && toMonth && toMonth <= fromMonth) {
            setToMonth(null);
        }
    }, [fromMonth]);

    const preColumnFilteredData = useMemo(() => {
        const occupancyFiltered = selectedOccupancyCombined.includes('All')
            ? processedData
            : processedData.filter(row => selectedOccupancyCombined.includes(row.OccupancyCombined));

        if (!selectedFinYear || fromMonth === null) return occupancyFiltered;

        const fyStart = parseInt(selectedFinYear.split('-')[0], 10);
        let targetMonths = [];

        if (toMonth === null || toMonth === fromMonth) {
            targetMonths = [fromMonth];
        } else {
            let started = false;
            for (const m of finOrderMonths) {
                if (m === fromMonth) started = true;
                if (started) targetMonths.push(m);
                if (m === toMonth) break;
            }
        }

        return occupancyFiltered.filter(row => {
            if (!row.financialYear || row.financialMonthNum === null) return false;
            const rowFYStart = parseInt(row.financialYear.split('-')[0], 10);
            const isInStartFY = row.financialMonthNum >= 4 && row.financialMonthNum <= 12 && rowFYStart === fyStart;
            const isInNextFY = row.financialMonthNum <= 3 && rowFYStart === fyStart + 1;
            const monthMatch = targetMonths.includes(row.financialMonthNum);

            return monthMatch && (isInStartFY || (toMonth <= 3 && isInNextFY));
        });
    }, [processedData, selectedOccupancyCombined, selectedFinYear, fromMonth, toMonth]);

    // Aggregated (Combined Total) view - Fixed Segments display
    const groupedDataFromPreColumn = useMemo(() => {
        const groups = {};
        preColumnFilteredData.forEach(row => {
            const seg = row.Segments || '(None)';
            if (!groups[seg]) {
                groups[seg] = { Segments: seg, NOP: 0, GWP: 0, GIC: 0, GEP: 0, NOC: 0, deltaRiskSI: 0 };
            }
            groups[seg].NOP += row.NOP;
            groups[seg].GWP += row.GWP;
            groups[seg].GIC += row.GIC;
            groups[seg].GEP += row.GEP;
            groups[seg].NOC += row.NOC;
            groups[seg].deltaRiskSI += row.deltaRiskSI;
        });

        return Object.values(groups).map(g => ({
            ...g,
            GicOverGep: g.GEP === 0 ? 0 : (g.GIC / g.GEP),
            AvgRate: g.deltaRiskSI === 0 ? 0 : (g.GWP / g.deltaRiskSI) * 1000
        }));
    }, [preColumnFilteredData]);

    // Monthly breakdown data
    const monthlyBreakdownData = useMemo(() => {
        if (viewMode !== 'monthly-breakdown' || selectedPeriodDisplay.type !== 'range' || fromMonth === toMonth) return null;

        const monthsInRange = [];
        let started = false;
        for (const m of finOrderMonths) {
            if (m === fromMonth) started = true;
            if (started) monthsInRange.push(m);
            if (m === toMonth) break;
        }

        const grouped = {};
        preColumnFilteredData.forEach(row => {
            const seg = row.Segments || '(None)';
            const month = row.financialMonthNum;
            if (!monthsInRange.includes(month)) return;

            if (!grouped[seg]) {
                grouped[seg] = { Segments: seg };
                monthsInRange.forEach(m => {
                    grouped[seg][`NOP_${m}`] = 0;
                    grouped[seg][`GWP_${m}`] = 0;
                    grouped[seg][`GIC_${m}`] = 0;
                    grouped[seg][`GEP_${m}`] = 0;
                    grouped[seg][`NOC_${m}`] = 0;
                    grouped[seg][`deltaRiskSI_${m}`] = 0;
                });
            }

            grouped[seg][`NOP_${month}`] += row.NOP;
            grouped[seg][`GWP_${month}`] += row.GWP;
            grouped[seg][`GIC_${month}`] += row.GIC;
            grouped[seg][`GEP_${month}`] += row.GEP;
            grouped[seg][`NOC_${month}`] += row.NOC;
            grouped[seg][`deltaRiskSI_${month}`] += row.deltaRiskSI;
        });

        return Object.values(grouped).map(row => {
            monthsInRange.forEach(m => {
                const gep = row[`GEP_${m}`] || 0;
                const gic = row[`GIC_${m}`] || 0;
                const gwp = row[`GWP_${m}`] || 0;
                const deltaSI = row[`deltaRiskSI_${m}`] || 0;
                row[`GicOverGep_${m}`] = gep === 0 ? 0 : (gic / gep);
                row[`AvgRate_${m}`] = deltaSI === 0 ? 0 : (gwp / deltaSI) * 1000;
            });
            return row;
        });
    }, [preColumnFilteredData, viewMode, fromMonth, toMonth, selectedPeriodDisplay.type]);

    const filteredData = useMemo(() => {
        let items = viewMode === 'monthly-breakdown' && monthlyBreakdownData ? monthlyBreakdownData : groupedDataFromPreColumn;
        items = items.filter(row => Object.keys(columnFilters).every(key => columnFilters[key] === 'Select' || String(row[key]) === String(columnFilters[key])));
        return items.map((r, i) => ({ ...r, id: i }));
    }, [groupedDataFromPreColumn, monthlyBreakdownData, columnFilters, viewMode]);

    const columnFilterOptions = useMemo(() => {
        const base = viewMode === 'monthly-breakdown' && monthlyBreakdownData ? monthlyBreakdownData : groupedDataFromPreColumn;
        const keys = ['Segments', 'NOP', 'GWP', 'GIC', 'GEP', 'GicOverGep', 'NOC', 'AvgRate'];
        const opts = {};
        keys.forEach(key => {
            const set = new Set();
            base.forEach(row => row[key] !== undefined && set.add(String(row[key])));
            opts[key] = Array.from(set).sort((a, b) => {
                const an = parseFloat(a), bn = parseFloat(b);
                return isNaN(an) || isNaN(bn) ? a.localeCompare(b) : an - bn;
            });
        });
        return opts;
    }, [groupedDataFromPreColumn, monthlyBreakdownData, viewMode]);

    const sortedData = useMemo(() => {
        let items = [...filteredData];
        if (sortConfig.key) {
            items.sort((a, b) => {
                const av = a[sortConfig.key] ?? '', bv = b[sortConfig.key] ?? '';
                if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1;
                if (av > bv) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return items;
    }, [filteredData, sortConfig]);

    const totalPages = Math.ceil(sortedData.length / itemsPerPage);
    const paginatedData = sortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const monthsInDisplayRange = useMemo(() => {
        if (selectedPeriodDisplay.type !== 'range' || fromMonth === toMonth) return [];
        const months = [];
        let started = false;
        for (const m of finOrderMonths) {
            if (m === fromMonth) started = true;
            if (started) months.push(m);
            if (m === toMonth) break;
        }
        return months;
    }, [fromMonth, toMonth, selectedPeriodDisplay.type]);

    const getColumnFilterOptionsForKey = (key) => {
        const options = columnFilterOptions[key] || [];
        const q = (columnFilterSearch[key] || '').toLowerCase();
        return q ? options.filter(o => String(o).toLowerCase().includes(q)) : options;
    };

    const toggleColumn = (key) => {
        setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <div className="dashboard-container">
            <div className="filter-section">
                {/* Financial Year */}
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
                                        <div key={fy} className={`dropdown-item ${selectedFinYear === fy ? 'active' : ''}`} onClick={() => {
                                            setSelectedFinYear(fy);
                                            setFromMonth(4);
                                            setToMonth(null);
                                            setIsFinDropdownOpen(false);
                                            setCurrentPage(1);
                                        }}>{fy}</div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* From Month */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label className="filter-label">FROM MONTH:</label>
                    <div className="custom-dropdown" ref={fromDropdownRef}>
                        <div className="dropdown-selected" onClick={() => setIsFromDropdownOpen(!isFromDropdownOpen)}>
                            {fromMonth ? monthNames[fromMonth - 1] : 'Select...'} <span className="arrow">{isFromDropdownOpen ? '▲' : '▼'}</span>
                        </div>
                        {isFromDropdownOpen && (
                            <div className="dropdown-menu">
                                <input type="text" className="dropdown-search" placeholder="Search..." value={fromSearch} onChange={e => setFromSearch(e.target.value)} autoFocus />
                                <div className="dropdown-options">
                                    {finOrderMonths.filter(m => monthNames[m-1].toLowerCase().includes(fromSearch.toLowerCase())).map(m => (
                                        <div key={`from-${m}`} className={`dropdown-item ${fromMonth === m ? 'active' : ''}`} onClick={() => {
                                            setFromMonth(m);
                                            setToMonth(null);
                                            setIsFromDropdownOpen(false);
                                            setCurrentPage(1);
                                        }}>{monthNames[m-1]}</div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* To Month */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label className="filter-label">TO MONTH:</label>
                    <div className="custom-dropdown" ref={toDropdownRef}>
                        <div className="dropdown-selected" onClick={() => setIsToDropdownOpen(!isToDropdownOpen)}>
                            {toMonth ? monthNames[toMonth - 1] : 'Select...'} <span className="arrow">{isToDropdownOpen ? '▲' : '▼'}</span>
                        </div>
                        {isToDropdownOpen && (
                            <div className="dropdown-menu">
                                <input type="text" className="dropdown-search" placeholder="Search..." value={toSearch} onChange={e => setToSearch(e.target.value)} autoFocus />
                                <div className="dropdown-options">
                                    {filteredToMonths.filter(m => monthNames[m-1].toLowerCase().includes(toSearch.toLowerCase())).map(m => (
                                        <div key={`to-${m}`} className={`dropdown-item ${toMonth === m ? 'active' : ''} ${fromMonth && m <= fromMonth ? 'disabled' : ''}`} onClick={() => {
                                            if (fromMonth && m <= fromMonth) return;
                                            setToMonth(m);
                                            setIsToDropdownOpen(false);
                                            setCurrentPage(1);
                                        }}>{monthNames[m-1]}</div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Occupancy */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label className="filter-label">OCCUPANCY (CODE - NAME):</label>
                    <div className="custom-dropdown" ref={combinedDropdownRef}>
                        <div className="dropdown-selected" onClick={() => setIsCombinedDropdownOpen(!isCombinedDropdownOpen)}>
                            {selectedOccupancyCombined.length === combinedOccupancyOptions.length ? 'All Selected' : `${selectedOccupancyCombined.length - (selectedOccupancyCombined.includes('All') ? 1 : 0)} selected`}
                            <span className="arrow">{isCombinedDropdownOpen ? '▲' : '▼'}</span>
                        </div>
                        {isCombinedDropdownOpen && (
                            <div className="dropdown-menu">
                                <input type="text" className="dropdown-search" placeholder="Search..." value={combinedSearch} onChange={e => setCombinedSearch(e.target.value)} autoFocus />
                                <div className="dropdown-options">
                                    {combinedOccupancyOptions.filter(opt => opt.toLowerCase().includes(combinedSearch.toLowerCase())).map(opt => {
                                        const isSelected = selectedOccupancyCombined.includes(opt);
                                        return (
                                            <div key={opt} className={`dropdown-item ${isSelected ? 'active' : ''}`} onClick={() => {
                                                if (opt === 'All') {
                                                    setSelectedOccupancyCombined(isSelected ? [] : ['All']);
                                                } else {
                                                    let updated = selectedOccupancyCombined.filter(x => x !== 'All');
                                                    updated = isSelected ? updated.filter(x => x !== opt) : [...updated, opt];
                                                    setSelectedOccupancyCombined(updated.length === 0 ? ['All'] : updated);
                                                }
                                                setCurrentPage(1);
                                            }}>
                                                <input type="checkbox" checked={isSelected} readOnly style={{ marginRight: 12 }} />
                                                {opt}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Period display with cross-year FY */}
            <div style={{ margin: '20px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: 30 }}>
                <div className="selected-period-container">
                    {selectedPeriodDisplay.type === 'all' ? 'All periods' :
                     selectedPeriodDisplay.type === 'single' ? selectedPeriodDisplay.from :
                     <>{selectedPeriodDisplay.from} <span style={{ margin: '0 15px', fontSize: '1.4em' }}>→</span> {selectedPeriodDisplay.to}</>
                    }
                </div>

                {selectedPeriodDisplay.type === 'range' && fromMonth !== toMonth && monthsInDisplayRange.length > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                            <input type="radio" name="viewMode" checked={viewMode === 'aggregated'} onChange={() => setViewMode('aggregated')} />
                            Combined Total
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                            <input type="radio" name="viewMode" checked={viewMode === 'monthly-breakdown'} onChange={() => setViewMode('monthly-breakdown')} />
                            Monthly Breakdown
                        </label>
                    </div>
                )}
            </div>

            {/* Customize Table Toggle Button */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <button className="pagination-btn" style={{ padding: '12px 32px', fontSize: '16px' }} onClick={() => setIsCustomizerOpen(!isCustomizerOpen)}>
                    {isCustomizerOpen ? 'Hide Customize Columns' : 'Customize Table Columns'}
                </button>
            </div>

            {/* Customize Columns Panel */}
            {isCustomizerOpen && (
                <div className="column-customizer">
                    <div className="column-customizer-title">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 17h18M3 12h18M3 7h18" stroke="#6366f1" strokeWidth="3" strokeLinecap="round"/>
                        </svg>
                        Customize Table Columns
                    </div>
                    <div className="column-list">
                        {['Segments', 'NOP', 'GWP', 'GIC', 'GEP', 'GicOverGep', 'NOC', 'AvgRate'].map(key => (
                            <div key={key} className="column-item" onClick={() => toggleColumn(key)}>
                                <input type="checkbox" checked={visibleColumns[key]} onChange={() => toggleColumn(key)} />
                                <label>{key === 'GicOverGep' ? 'GIC/GEP' : key === 'AvgRate' ? 'Avg Rate' : key}</label>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="table-wrapper">
                {viewMode === 'monthly-breakdown' && monthlyBreakdownData && monthsInDisplayRange.length > 1 ? (
                    <table className="data-table">
                        <thead>
                            <tr>
                                {visibleColumns.Segments && <th rowSpan={2} className="sticky-segment">Segment</th>}
                                {monthsInDisplayRange.map(m => {
                                    const count = ['NOP', 'GWP', 'GIC', 'GEP', 'GicOverGep', 'NOC', 'AvgRate'].filter(k => visibleColumns[k]).length;
                                    return count > 0 ? <th key={m} colSpan={count} className="month-group-header">{monthNames[m-1].slice(0, 3)}</th> : null;
                                })}
                            </tr>
                            <tr>
                                {monthsInDisplayRange.flatMap(m => ['NOP', 'GWP', 'GIC', 'GEP', 'GicOverGep', 'NOC', 'AvgRate'].filter(k => visibleColumns[k]).map(col => (
                                    <th key={`${m}-${col}`} className="sub-header">{col === 'GicOverGep' ? 'Gic/GEP' : col === 'AvgRate' ? 'Avg Rate' : col}</th>
                                )))}
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedData.map((row, idx) => (
                                <tr key={row.id}>
                                    {visibleColumns.Segments && <td className="segment-cell">{row.Segments}</td>}
                                    {monthsInDisplayRange.flatMap(m => ['NOP', 'GWP', 'GIC', 'GEP', 'GicOverGep', 'NOC', 'AvgRate'].filter(k => visibleColumns[k]).map(col => {
                                        const value = row[`${col}_${m}`] || 0;
                                        return (
                                            <td key={`${m}-${col}`} className={`num-cell ${col === 'GIC' && value < 0 ? 'negative-val' : ''} ${col === 'GicOverGep' ? 'ratio-cell' : col === 'AvgRate' ? 'avg-rate-cell' : ''}`}>
                                                {fmtNum(value)}
                                            </td>
                                        );
                                    }))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th className="sl-col">Sl. No</th>
                                {['Segments', 'NOP', 'GWP', 'GIC', 'GEP', 'GicOverGep', 'NOC', 'AvgRate'].filter(k => visibleColumns[k]).map(key => (
                                    <th key={key}>
                                        <div style={{ position: 'relative' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div className="sort-label" onClick={() => setSortConfig({ key, direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc' })} style={{ cursor: 'pointer' }}>
                                                    {key === 'GicOverGep' ? 'GIC/GEP' : key === 'AvgRate' ? 'Avg Rate' : key}
                                                    <span style={{ marginLeft: 8 }}>{sortConfig.key === key ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
                                                </div>
                                                <div ref={el => columnFilterRefs.current[key] = el}>
                                                    <button className="filter-icon-btn" onClick={(e) => { e.stopPropagation(); setOpenColumnFilterKey(prev => prev === key ? null : key); }}>
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                            <path d="M3 5h18" stroke="#000" strokeWidth="2" strokeLinecap="round"/>
                                                            <path d="M6 12h12" stroke="#000" strokeWidth="2" strokeLinecap="round"/>
                                                            <path d="M10 19h4" stroke="#000" strokeWidth="2" strokeLinecap="round"/>
                                                        </svg>
                                                    </button>
                                                    {openColumnFilterKey === key && (
                                                        <div className="dropdown-menu" style={{ width: 300, right: 0, top: '110%' }}>
                                                            <input type="text" className="dropdown-search" placeholder="Search..." value={columnFilterSearch[key] || ''} onChange={e => setColumnFilterSearch(prev => ({ ...prev, [key]: e.target.value }))} autoFocus />
                                                            <div className="dropdown-options">
                                                                <div className="dropdown-item" onClick={() => { setColumnFilters(prev => ({ ...prev, [key]: 'Select' })); setOpenColumnFilterKey(null); }}>Clear filter</div>
                                                                {getColumnFilterOptionsForKey(key).map(opt => (
                                                                    <div key={opt} className={`dropdown-item ${columnFilters[key] === opt ? 'active' : ''}`} onClick={() => { setColumnFilters(prev => ({ ...prev, [key]: opt })); setOpenColumnFilterKey(null); }}>{opt}</div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedData.map((row, idx) => (
                                <tr key={row.id}>
                                    <td className="sl-col">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                                    {['Segments', 'NOP', 'GWP', 'GIC', 'GEP', 'GicOverGep', 'NOC', 'AvgRate'].filter(k => visibleColumns[k]).map(key => (
                                        <td key={key} className={`num-cell ${key === 'GIC' && row[key] < 0 ? 'negative-val' : ''} ${key === 'GicOverGep' ? 'ratio-cell' : key === 'AvgRate' ? 'avg-rate-cell' : ''} ${key === 'Segments' ? 'segment-cell' : ''}`}>
                                            {key === 'Segments' ? (row[key] || '(None)') : fmtNum(row[key])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="pagination-container">
                <div className="range-selector">
                    <label>Show </label>
                    <select value={itemsPerPage} onChange={e => setItemsPerPage(Number(e.target.value))} className="pagination-select">
                        {[50, 100, 200].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <span> records</span>
                </div>
                <div className="page-navigation">
                    <button className="pagination-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</button>
                    <span>Page {currentPage} of {totalPages || 1}</span>
                    <button className="pagination-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</button>
                </div>
            </div>
        </div>
    );
}

export default Body;
