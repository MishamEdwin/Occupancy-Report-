import React, { useState, useMemo, useEffect, useRef } from 'react';
import xl_data from '/src/data/xl_data.json';

function Body() {
    const [data, setData] = useState([]);

    // Combined occupancy selection state (multi-select like before)
    const [selectedOccupancyCombined, setSelectedOccupancyCombined] = useState(['All']);
    const [isCombinedDropdownOpen, setIsCombinedDropdownOpen] = useState(false);
    const [combinedSearch, setCombinedSearch] = useState('');
    const combinedDropdownRef = useRef(null);

    // Period dropdown UI state (single-select custom dropdowns)
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

    // Period filter state (financial year + from/to month)
    const [selectedFinYear, setSelectedFinYear] = useState(null); // e.g., '2025-26'
    const [fromMonth, setFromMonth] = useState(null); // month number 1..12
    const [toMonth, setToMonth] = useState(null); // month number 1..12

    // Column filter dropdown UI state: which column's filter menu is open (key) and per-column search text
    const [openColumnFilterKey, setOpenColumnFilterKey] = useState(null);
    const [columnFilterSearch, setColumnFilterSearch] = useState({}); // { key: 'search text' }
    const columnFilterRefs = useRef({}); // refs for each column filter menu

    useEffect(() => {
        setData(Array.isArray(xl_data) ? xl_data : []);
        const handleClickOutside = (event) => {
            if (combinedDropdownRef.current && !combinedDropdownRef.current.contains(event.target)) {
                setIsCombinedDropdownOpen(false);
            }
            if (finDropdownRef.current && !finDropdownRef.current.contains(event.target)) {
                setIsFinDropdownOpen(false);
            }
            if (fromDropdownRef.current && !fromDropdownRef.current.contains(event.target)) {
                setIsFromDropdownOpen(false);
            }
            if (toDropdownRef.current && !toDropdownRef.current.contains(event.target)) {
                setIsToDropdownOpen(false);
            }
            if (openColumnFilterKey) {
                const ref = columnFilterRefs.current[openColumnFilterKey];
                if (ref && !ref.contains(event.target)) {
                    setOpenColumnFilterKey(null);
                }
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
    // financial order April -> March
    const finOrderMonths = [4,5,6,7,8,9,10,11,12,1,2,3];

    const getCalendarYearForMonth = (finYearStart, monthNum) => {
        if (monthNum >= 4 && monthNum <= 12) return finYearStart;
        return finYearStart + 1;
    };

    const getPeriodIndex = (calendarYear, monthNum) => {
        return calendarYear * 12 + (monthNum - 1);
    };

    const processedData = useMemo(() => {
        return data.map((row, index) => {
            const GWP = parseNumber(row['Prem']);
            const NOP = parseNumber(row['Net Pol']);
            const GIC = parseNumber(row['Claim incurred in period']);
            const GEP = parseNumber(row['Earned Prem']);
            const NOC = parseNumber(row['Num claim registered']);
            const deltaRiskSI = parseNumber(row['Delta risk SI']);

            // Parse "Financial (GWP)" like "04, 2025-26"
            const finRaw = row['Financial (GWP)'] || '';
            let monthNum = null;
            let finYear = null;
            let periodIndex = null;
            let periodLabel = '(None)';
            try {
                const parts = String(finRaw).split(',');
                if (parts.length >= 2) {
                    const m = parseInt(parts[0].trim(), 10);
                    const y = parts[1].trim();
                    if (!isNaN(m)) monthNum = m;
                    finYear = y || null;
                } else {
                    const fallback = String(finRaw).trim().split(/\s+/);
                    if (fallback.length >= 2) {
                        const m = parseInt(fallback[0].replace(/[^0-9]/g, ''), 10);
                        const y = fallback[1].trim();
                        if (!isNaN(m)) monthNum = m;
                        finYear = y || null;
                    }
                }
                if (monthNum !== null && finYear) {
                    const startYear = parseInt(finYear.split('-')[0], 10);
                    if (!isNaN(startYear)) {
                        const calendarYear = getCalendarYearForMonth(startYear, monthNum);
                        periodIndex = getPeriodIndex(calendarYear, monthNum);
                    }
                    const monthName = monthNames[(monthNum - 1)] || `M${monthNum}`;
                    periodLabel = `${monthName}, ${finYear}`;
                }
            } catch (e) {
                // ignore
            }

            const OccName = row['GC Occupancies Name'] || '(None)';
            const OccCode = row['GC Occupancies'] || '(None)';
            const combinedLabel = `${OccCode}-${OccName}`;

            return {
                id: index,
                Segments: row['UW Sub Channel'] || row['UW sub channel'] || '(None)',
                OccupancyName: OccName,
                OccupancyCode: OccCode,
                OccupancyCombined: combinedLabel,
                NOP, GWP, GIC, GEP, NOC, deltaRiskSI,
                GicOverGep: GEP === 0 ? 0 : (GIC / GEP),
                AvgRate: deltaRiskSI === 0 ? 0 : (GWP / deltaRiskSI) * 1000,
                isSummary: false,
                financialMonthNum: monthNum,
                financialYear: finYear,
                periodIndex,
                periodLabel
            };
        });
    }, [data]);

    // Build list of available financial years from data (unique)
    const financialYears = useMemo(() => {
        const set = new Set();
        processedData.forEach(item => {
            if (item.financialYear) set.add(item.financialYear);
        });
        const arr = Array.from(set).sort((a, b) => {
            const aStart = parseInt(a.split('-')[0], 10) || 0;
            const bStart = parseInt(b.split('-')[0], 10) || 0;
            return aStart - bStart;
        });
        return arr;
    }, [processedData]);

    // period options list (individual month-year labels) used by earlier UI
    const periodOptions = useMemo(() => {
        const map = new Map();
        processedData.forEach(item => {
            if (typeof item.periodIndex === 'number' && item.periodLabel) {
                if (!map.has(item.periodIndex)) {
                    map.set(item.periodIndex, item.periodLabel);
                }
            }
        });
        const entries = Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
        return entries.map(([idx, label]) => ({ index: idx, label }));
    }, [processedData]);

    useEffect(() => {
        if (financialYears.length > 0) {
            const latestFY = financialYears[financialYears.length - 1];
            setSelectedFinYear(prev => prev === null ? latestFY : prev);
            setFromMonth(prev => prev === null ? 4 : prev);
            setToMonth(prev => prev === null ? 3 : prev);
        } else {
            setSelectedFinYear(null);
            setFromMonth(null);
            setToMonth(null);
        }
        setCurrentPage(1);
    }, [financialYears]);

    const combinedOccupancyOptions = useMemo(() => {
        const set = new Set();
        processedData.forEach(item => {
            if (item.OccupancyCombined) set.add(item.OccupancyCombined);
        });
        return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
    }, [processedData]);

    const filteredCombinedOptions = combinedOccupancyOptions.filter(opt =>
        opt.toLowerCase().includes(combinedSearch.toLowerCase())
    );

    // preColumnFilteredData: occupancy + period applied (but not column filters)
    const preColumnFilteredData = useMemo(() => {
        const occupancyFiltered = selectedOccupancyCombined.includes('All')
            ? processedData
            : processedData.filter(row => selectedOccupancyCombined.includes(row.OccupancyCombined));

        let periodFiltered = occupancyFiltered;
        if (selectedFinYear && fromMonth !== null && toMonth !== null) {
            const startYear = parseInt(selectedFinYear.split('-')[0], 10);
            if (!isNaN(startYear)) {
                const startIdx = getPeriodIndex(getCalendarYearForMonth(startYear, fromMonth), fromMonth);
                const endIdx = getPeriodIndex(getCalendarYearForMonth(startYear, toMonth), toMonth);
                const lower = Math.min(startIdx, endIdx);
                const upper = Math.max(startIdx, endIdx);
                periodFiltered = occupancyFiltered.filter(row => {
                    return typeof row.periodIndex === 'number' && row.periodIndex >= lower && row.periodIndex <= upper;
                });
            }
        }
        return periodFiltered;
    }, [processedData, selectedOccupancyCombined, selectedFinYear, fromMonth, toMonth]);

    // groupedDataFromPreColumn: aggregated groups (the actual values visible in the table before applying column filters)
    const groupedDataFromPreColumn = useMemo(() => {
        const groups = {};
        preColumnFilteredData.forEach(row => {
            if (!groups[row.Segments]) {
                groups[row.Segments] = {
                    Segments: row.Segments,
                    NOP: 0,
                    GWP: 0,
                    GIC: 0,
                    GEP: 0,
                    NOC: 0,
                    deltaRiskSI: 0
                };
            }
            groups[row.Segments].NOP += row.NOP;
            groups[row.Segments].GWP += row.GWP;
            groups[row.Segments].GIC += row.GIC;
            groups[row.Segments].GEP += row.GEP;
            groups[row.Segments].NOC += row.NOC;
            groups[row.Segments].deltaRiskSI += row.deltaRiskSI;
        });
        return Object.keys(groups).sort().map(segment => {
            const g = groups[segment];
            return {
                ...g,
                GicOverGep: g.GEP === 0 ? 0 : (g.GIC / g.GEP),
                AvgRate: g.deltaRiskSI === 0 ? 0 : (g.GWP / g.deltaRiskSI) * 1000
            };
        });
    }, [preColumnFilteredData]);

    // Main filteredData: apply column filters on groupedDataFromPreColumn (so column filter options reflect actual table values)
    const filteredData = useMemo(() => {
        let items = groupedDataFromPreColumn.slice();

        // Apply columnFilters to grouped rows
        items = items.filter(row => {
            return Object.keys(columnFilters).every(key => {
                if (columnFilters[key] === 'Select') return true;
                const rowVal = row[key];
                const filterVal = columnFilters[key];
                const rowNum = parseFloat(String(rowVal).replace(/,/g, ''));
                const filterNum = parseFloat(String(filterVal).replace(/,/g, ''));
                if (!Number.isNaN(rowNum) && !Number.isNaN(filterNum)) {
                    return rowNum === filterNum;
                }
                return String(rowVal) === String(filterVal);
            });
        });

        // Preserve isSummary flag false for aggregated rows
        return items.map((r, i) => ({ ...r, id: i, isSummary: false }));
    }, [groupedDataFromPreColumn, columnFilters]);

    // Build column filter options from groupedDataFromPreColumn (so they show values visible in table even before occupancy selection)
    const columnFilterOptions = useMemo(() => {
        const keys = ['Segments', 'NOP', 'GWP', 'GIC', 'GEP', 'GicOverGep', 'NOC', 'AvgRate'];
        const options = {};
        keys.forEach(key => {
            const set = new Set();
            groupedDataFromPreColumn.forEach(row => {
                const value = row[key];
                set.add(String(value));
            });
            const arr = Array.from(set);
            arr.sort((a, b) => {
                const an = parseFloat(a);
                const bn = parseFloat(b);
                if (!Number.isNaN(an) && !Number.isNaN(bn)) return an - bn;
                return a.localeCompare(b);
            });
            options[key] = arr;
        });
        return options;
    }, [groupedDataFromPreColumn]);

    const sortedData = useMemo(() => {
        let sortableItems = [...filteredData];
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
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

    // Selected period parts for display (centered, spaced)
    const selectedPeriodParts = useMemo(() => {
        if (!selectedFinYear || fromMonth === null || toMonth === null) return ['All periods'];
        const startYear = parseInt(selectedFinYear.split('-')[0], 10);
        if (isNaN(startYear)) return ['All periods'];
        const startIdx = getPeriodIndex(getCalendarYearForMonth(startYear, fromMonth), fromMonth);
        const endIdx = getPeriodIndex(getCalendarYearForMonth(startYear, toMonth), toMonth);
        const lower = Math.min(startIdx, endIdx);
        const upper = Math.max(startIdx, endIdx);
        const lowerMonth = (lower % 12) + 1;
        const upperMonth = (upper % 12) + 1;
        const lowerLabel = `${monthNames[lowerMonth - 1]}, ${selectedFinYear}`;
        const upperLabel = `${monthNames[upperMonth - 1]}, ${selectedFinYear}`;
        if (lower === upper) return [lowerLabel];
        return [lowerLabel, upperLabel];
    }, [selectedFinYear, fromMonth, toMonth]);

    // helpers for period dropdown searches
    const filteredFinYears = financialYears.filter(fy => fy.toLowerCase().includes(finSearch.toLowerCase()));
    const filteredFromMonths = finOrderMonths.filter(m => monthNames[m-1].toLowerCase().includes(fromSearch.toLowerCase()));
    const filteredToMonths = finOrderMonths.filter(m => monthNames[m-1].toLowerCase().includes(toSearch.toLowerCase()));

    const getColumnFilterOptionsForKey = (key) => {
        const options = columnFilterOptions[key] || [];
        const q = (columnFilterSearch[key] || '').toLowerCase().trim();
        if (!q) return options;
        return options.filter(o => String(o).toLowerCase().includes(q));
    };

    return (
        <div className="dashboard-container">
            <div className="filter-section" style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {/* Period filter: Financial Year, From Month, To Month (custom dropdowns) */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label className="filter-label">FINANCIAL YEAR:</label>
                    <div className="custom-dropdown" ref={finDropdownRef}>
                        <div className="dropdown-selected" onClick={() => setIsFinDropdownOpen(prev => !prev)}>
                            {selectedFinYear ? selectedFinYear : 'Select...'}
                            <span className="arrow">{isFinDropdownOpen ? 'â–²' : 'â–¼'}</span>
                        </div>
                        {isFinDropdownOpen && (
                            <div className="dropdown-menu">
                                <input type="text" className="dropdown-search" placeholder="Search financial year..." value={finSearch} onChange={(e)=>setFinSearch(e.target.value)} autoFocus />
                                <div className="dropdown-options">
                                    {filteredFinYears.map(fy => {
                                        const isSelected = selectedFinYear === fy;
                                        return (
                                            <div key={fy} className={`dropdown-item ${isSelected ? 'active' : ''}`} onClick={()=>{
                                                setSelectedFinYear(fy);
                                                setFromMonth(4);
                                                setToMonth(3);
                                                setIsFinDropdownOpen(false);
                                                setCurrentPage(1);
                                            }}>{fy}</div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label className="filter-label">FROM MONTH:</label>
                    <div className="custom-dropdown" ref={fromDropdownRef}>
                        <div className="dropdown-selected" onClick={() => setIsFromDropdownOpen(prev => !prev)}>
                            {fromMonth ? monthNames[fromMonth - 1] : 'Select...'}
                            <span className="arrow">{isFromDropdownOpen ? 'â–²' : 'â–¼'}</span>
                        </div>
                        {isFromDropdownOpen && (
                            <div className="dropdown-menu">
                                <input type="text" className="dropdown-search" placeholder="Search month..." value={fromSearch} onChange={(e)=>setFromSearch(e.target.value)} autoFocus />
                                <div className="dropdown-options">
                                    {filteredFromMonths.map(m => {
                                        const label = monthNames[m-1];
                                        const isSelected = fromMonth === m;
                                        return <div key={`from-${m}`} className={`dropdown-item ${isSelected ? 'active' : ''}`} onClick={()=>{
                                            setFromMonth(m);
                                            setIsFromDropdownOpen(false);
                                            setCurrentPage(1);
                                        }}>{label}</div>;
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label className="filter-label">TO MONTH:</label>
                    <div className="custom-dropdown" ref={toDropdownRef}>
                        <div className="dropdown-selected" onClick={() => setIsToDropdownOpen(prev => !prev)}>
                            {toMonth ? monthNames[toMonth - 1] : 'Select...'}
                            <span className="arrow">{isToDropdownOpen ? 'â–²' : 'â–¼'}</span>
                        </div>
                        {isToDropdownOpen && (
                            <div className="dropdown-menu">
                                <input type="text" className="dropdown-search" placeholder="Search month..." value={toSearch} onChange={(e)=>setToSearch(e.target.value)} autoFocus />
                                <div className="dropdown-options">
                                    {filteredToMonths.map(m => {
                                        const label = monthNames[m-1];
                                        const isSelected = toMonth === m;
                                        return <div key={`to-${m}`} className={`dropdown-item ${isSelected ? 'active' : ''}`} onClick={()=>{
                                            setToMonth(m);
                                            setIsToDropdownOpen(false);
                                            setCurrentPage(1);
                                        }}>{label}</div>;
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Combined Occupancy dropdown */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label className="filter-label">OCCUPANCY (CODE - NAME):</label>
                    <div className="custom-dropdown" ref={combinedDropdownRef}>
                        <div className="dropdown-selected" onClick={() => setIsCombinedDropdownOpen(prev => !prev)}>
                            {selectedOccupancyCombined.length === 0 ? 'Select...' : selectedOccupancyCombined.length === combinedOccupancyOptions.length ? 'All Selected' : `${selectedOccupancyCombined.length} selected`}
                            <span className="arrow">{isCombinedDropdownOpen ? 'â–²' : 'â–¼'}</span>
                        </div>
                        {isCombinedDropdownOpen && (
                            <div className="dropdown-menu">
                                <input type="text" className="dropdown-search" placeholder="Search occupancy..." value={combinedSearch} onChange={(e)=>setCombinedSearch(e.target.value)} autoFocus />
                                <div className="dropdown-options">
                                    {filteredCombinedOptions.map(opt => {
                                        const isSelected = selectedOccupancyCombined.includes(opt);
                                        return (
                                            <div key={opt} className={`dropdown-item ${isSelected ? 'active' : ''} ${opt === 'All' ? 'all-option' : ''}`} onClick={()=>{
                                                if (opt === 'All') {
                                                    setSelectedOccupancyCombined(isSelected ? [] : ['All']);
                                                } else {
                                                    let updated;
                                                    if (isSelected) {
                                                        updated = selectedOccupancyCombined.filter(item => item !== opt && item !== 'All');
                                                    } else {
                                                        updated = selectedOccupancyCombined.filter(item => item !== 'All');
                                                        updated.push(opt);
                                                    }
                                                    setSelectedOccupancyCombined(updated.length === 0 ? ['All'] : updated);
                                                }
                                                setCurrentPage(1);
                                            }}>
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
            </div>

            {/* Selected period info centered above table */}
            <div style={{ marginTop: 12, marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
                <div className="selected-period-container">
                    {selectedPeriodParts.length === 1 ? (
                        <div className="period-item">{selectedPeriodParts[0]}</div>
                    ) : (
                        <>
                            <div className="period-item">{selectedPeriodParts[0]}</div>
                            <div className="period-item">{selectedPeriodParts[1]}</div>
                        </>
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
                                    <div className="header-content" style={{ position: 'relative' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div
                                                className="sort-label"
                                                onClick={() => setSortConfig({key, direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'})}
                                                style={{ cursor: 'pointer', userSelect: 'none' }}
                                            >
                                                {key === 'GicOverGep' ? 'GIC/GEP' : key === 'AvgRate' ? 'Avg Rate' : key}
                                                <span style={{ marginLeft: 8 }}>{sortConfig.key === key ? (sortConfig.direction === 'asc' ? 'â–²' : 'â–¼') : 'â†•'}</span>
                                            </div>

                                            {/* Filter icon button (more visible, white icon on blue background) */}
                                            <div style={{ marginLeft: 8, position: 'relative' }} ref={el => { columnFilterRefs.current[key] = el; }}>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setOpenColumnFilterKey(prev => prev === key ? null : key);
                                                        setColumnFilterSearch(prev => ({ ...prev, [key]: prev[key] || '' }));
                                                    }}
                                                    title="Filter"
                                                    className="filter-icon-btn"
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                                        <path d="M3 5h18" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                        <path d="M6 12h12" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                        <path d="M10 19h4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                    </svg>
                                                </button>

                                                {/* Column filter menu (search + options) */}
                                                {openColumnFilterKey === key && (
                                                    <div
                                                        ref={el => { columnFilterRefs.current[key] = el || columnFilterRefs.current[key]; }}
                                                        className="dropdown-menu"
                                                        style={{ width: 300, right: 0, left: 'auto', top: '110%' }}
                                                    >
                                                        <input
                                                            type="text"
                                                            className="dropdown-search"
                                                            placeholder="Search..."
                                                            value={columnFilterSearch[key] || ''}
                                                            onChange={(e) => setColumnFilterSearch(prev => ({ ...prev, [key]: e.target.value }))}
                                                            autoFocus
                                                        />
                                                        <div className="dropdown-options">
                                                            <div
                                                                className={`dropdown-item ${columnFilters[key] === 'Select' ? 'active' : ''} all-option`}
                                                                onClick={() => {
                                                                    setColumnFilters(prev => ({ ...prev, [key]: 'Select' }));
                                                                    setOpenColumnFilterKey(null);
                                                                }}
                                                            >
                                                                Clear filter
                                                            </div>

                                                            {getColumnFilterOptionsForKey(key).length === 0 && (
                                                                <div className="no-results">No options</div>
                                                            )}

                                                            {getColumnFilterOptionsForKey(key).map(opt => {
                                                                const isActive = String(columnFilters[key]) === String(opt);
                                                                return (
                                                                    <div
                                                                        key={opt}
                                                                        className={`dropdown-item ${isActive ? 'active' : ''}`}
                                                                        onClick={() => {
                                                                            setColumnFilters(prev => ({ ...prev, [key]: opt }));
                                                                            setOpenColumnFilterKey(null);
                                                                        }}
                                                                    >
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
