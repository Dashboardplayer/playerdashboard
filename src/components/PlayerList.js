import React, { useEffect, useState } from 'react';
import { playerAPI } from '../hooks/apiClient';
import useRealtimeUpdates from '../hooks/useRealtimeUpdates';

const PlayerList = ({ companyId = null }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [initialPlayers, setInitialPlayers] = useState([]);
  
  // Fetch function that will be passed to useRealtimeUpdates
  const fetchPlayers = async () => {
    try {
      const result = await playerAPI.getAll(companyId);
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
  const players = useRealtimeUpdates('player', initialPlayers, fetchPlayers);

  // Initial data fetch
  useEffect(() => {
    const loadPlayers = async () => {
      setIsLoading(true);
      const result = await fetchPlayers();
      if (result.data) {
        setInitialPlayers(result.data);
      }
      setIsLoading(false);
    };

    loadPlayers();
  }, [companyId]);

  if (isLoading) return <div>Loading players...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="player-list">
      <h2>Players</h2>
      {players.length === 0 ? (
        <p>No players found</p>
      ) : (
        <ul>
          {players.map(player => (
            <li key={player._id}>
              {player.name || player.device_id}
              {player.current_url && (
                <span className="current-url"> - {player.current_url}</span>
              )}
              <span className={`status ${player.is_online ? 'online' : 'offline'}`}>
                {player.is_online ? 'Online' : 'Offline'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PlayerList; 