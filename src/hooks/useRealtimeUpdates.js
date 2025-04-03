import { useEffect, useState } from 'react';

/**
 * Hook to subscribe to real-time updates for entities
 * @param {string} entityType - Type of entity to subscribe to ('player', 'company', 'user')
 * @param {Array} initialData - Initial data array
 * @param {Function} fetchData - Function to fetch fresh data if needed
 * @returns {Array} - Current data array that updates in real-time
 */
const useRealtimeUpdates = (entityType, initialData = [], fetchData = null) => {
  const [data, setData] = useState(initialData);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    const handleUpdate = async (event) => {
      const { type, data: updateData } = event.detail;

      // If we have a fetchData function and this is a create/delete operation,
      // fetch fresh data to ensure we have the complete state
      if (fetchData && (type.includes('created') || type.includes('deleted'))) {
        const result = await fetchData();
        if (result?.data) {
          setData(result.data);
          return;
        }
      }

      // Otherwise, update the local state based on the operation
      switch (type) {
        case `${entityType}_created`:
          setData(prev => [...prev, updateData]);
          break;

        case `${entityType}_updated`:
          setData(prev => prev.map(item => 
            item._id === updateData._id ? { ...item, ...updateData } : item
          ));
          break;

        case `${entityType}_deleted`:
          setData(prev => prev.filter(item => 
            item._id !== updateData.id && item._id !== updateData._id
          ));
          break;

        default:
          break;
      }
    };

    // Add event listener for the specific entity type
    window.addEventListener(`${entityType}_update`, handleUpdate);

    return () => {
      window.removeEventListener(`${entityType}_update`, handleUpdate);
    };
  }, [entityType, fetchData]);

  return data;
};

export default useRealtimeUpdates; 