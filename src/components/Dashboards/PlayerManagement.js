import React, { useEffect, useState } from 'react';
import playerAPI from '../../services/playerAPI';

const PlayerManagement = () => {
  const [players, setPlayers] = useState([]);
  const [wsConnection, setWsConnection] = useState(null);
  const [error, setError] = useState(null);

  // Handle WebSocket messages
  useEffect(() => {
    if (!wsConnection) return;

    const handleMessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'player_deleted':
            console.log('Player deleted event received');
            setPlayers(prevPlayers => prevPlayers.filter(p => p._id !== message.data.id));
            break;
          case 'player_updated':
            console.log('Player updated event received');
            setPlayers(prevPlayers => 
              prevPlayers.map(p => p._id === message.data._id ? message.data : p)
            );
            break;
          case 'player_created':
            console.log('Player created event received');
            setPlayers(prevPlayers => [...prevPlayers, message.data]);
            break;
          default:
            break;
        }
      } catch (error) {
        console.error('Error processing WebSocket message');
      }
    };

    wsConnection.addEventListener('message', handleMessage);
    return () => wsConnection.removeEventListener('message', handleMessage);
  }, [wsConnection]);

  // Handle player deletion
  const handleDeletePlayer = async (player) => {
    if (!player || !player._id) {
      console.error('Invalid player data');
      return;
    }

    try {
      const result = await playerAPI.delete(player._id);
      if (result.error) {
        console.error('Error deleting player');
        setError(result.error);
      }
    } catch (error) {
      console.error('Error in handleDeletePlayer');
      setError(error.message);
    }
  };

  return (
    <div>
      {/* Render your component content here */}
    </div>
  );
};

export default PlayerManagement; 