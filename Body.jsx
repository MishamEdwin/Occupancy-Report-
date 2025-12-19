import React from 'react';
import './Body.css';
import SelectedPeriod from './components/SelectedPeriod';
import ReportTable from './components/ReportTable';
import FilterPanel from './components/FilterPanel';

const Body = ({ selectedPeriod, reportData, isLoading }) => {
  return (
    <div className="body-container">
      <div className="selected-period-container">
        <SelectedPeriod 
          financialYear={selectedPeriod?.financialYear}
          fromMonth={selectedPeriod?.fromMonth}
          toMonth={selectedPeriod?.toMonth}
        />
      </div>
      
      <div className="content-wrapper">
        <FilterPanel />
        <ReportTable 
          data={reportData}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};

export default Body;
