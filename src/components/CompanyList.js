import React, { useEffect, useState } from 'react';
import { companyAPI } from '../hooks/apiClient';
import useRealtimeUpdates from '../hooks/useRealtimeUpdates';

const CompanyList = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [initialCompanies, setInitialCompanies] = useState([]);

  // Fetch function that will be passed to useRealtimeUpdates
  const fetchCompanies = async () => {
    try {
      const result = await companyAPI.getAll();
      if (result.error) {
        setError(result.error);
        return { data: [] };
      }
      return result;
    } catch (error) {
      setError(error.message);
      return { data: [] };
    }
  };

  // Use our real-time updates hook
  const companies = useRealtimeUpdates('company', initialCompanies, fetchCompanies);

  // Initial data fetch
  useEffect(() => {
    const loadCompanies = async () => {
      setIsLoading(true);
      const result = await fetchCompanies();
      if (result.data) {
        setInitialCompanies(result.data);
      }
      setIsLoading(false);
    };

    loadCompanies();
  }, []);

  if (isLoading) return <div>Loading companies...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="company-list">
      <h2>Companies</h2>
      {companies.length === 0 ? (
        <p>No companies found</p>
      ) : (
        <ul>
          {companies.map(company => (
            <li key={company._id}>
              <span className="company-name">{company.name}</span>
              <span className="company-status"> - {company.active ? 'Active' : 'Inactive'}</span>
              {company.player_count !== undefined && (
                <span className="company-players"> ({company.player_count} players)</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CompanyList; 