import React, { useEffect, useState } from 'react';
import { userAPI } from '../hooks/apiClient';
import useRealtimeUpdates from '../hooks/useRealtimeUpdates';

const UserList = ({ companyId = null }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [initialUsers, setInitialUsers] = useState([]);

  // Fetch function that will be passed to useRealtimeUpdates
  const fetchUsers = async () => {
    try {
      const result = await userAPI.getAll(companyId);
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
  const users = useRealtimeUpdates('user', initialUsers, fetchUsers);

  // Initial data fetch
  useEffect(() => {
    const loadUsers = async () => {
      setIsLoading(true);
      const result = await fetchUsers();
      if (result.data) {
        setInitialUsers(result.data);
      }
      setIsLoading(false);
    };

    loadUsers();
  }, [companyId]);

  if (isLoading) return <div>Loading users...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="user-list">
      <h2>Users</h2>
      {users.length === 0 ? (
        <p>No users found</p>
      ) : (
        <ul>
          {users.map(user => (
            <li key={user._id}>
              <span className="user-email">{user.email}</span>
              <span className="user-role"> - {user.role}</span>
              {user.company_name && (
                <span className="user-company"> ({user.company_name})</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default UserList; 