import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

// Users
export const useUsers = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.users.getAll();
      return response.data;
    }
  });
};

export const useUser = (id) => {
  return useQuery({
    queryKey: ['users', id],
    queryFn: async () => {
      const response = await api.users.getById(id);
      return response.data;
    },
    enabled: !!id
  });
};

// Companies
export const useCompanies = () => {
  return useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const response = await api.companies.getAll();
      return response.data;
    }
  });
};

export const useCompany = (id) => {
  return useQuery({
    queryKey: ['companies', id],
    queryFn: async () => {
      const response = await api.companies.getById(id);
      return response.data;
    },
    enabled: !!id
  });
};

// Players
export const usePlayers = () => {
  return useQuery({
    queryKey: ['players'],
    queryFn: async () => {
      const response = await api.players.getAll();
      return response.data;
    }
  });
};

export const usePlayer = (id) => {
  return useQuery({
    queryKey: ['players', id],
    queryFn: async () => {
      const response = await api.players.getById(id);
      return response.data;
    },
    enabled: !!id
  });
};

// Mutations
export const useCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const response = await api.users.create(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
    }
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await api.users.update(id, data);
      return response.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries(['users']);
      queryClient.invalidateQueries(['users', id]);
    }
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      await api.users.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
    }
  });
};

// Similar mutations for companies and players
export const useCreateCompany = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const response = await api.companies.create(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['companies']);
    }
  });
};

export const useUpdateCompany = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await api.companies.update(id, data);
      return response.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries(['companies']);
      queryClient.invalidateQueries(['companies', id]);
    }
  });
};

export const useDeleteCompany = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      await api.companies.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['companies']);
    }
  });
};

export const useCreatePlayer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const response = await api.players.create(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['players']);
    }
  });
};

export const useUpdatePlayer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await api.players.update(id, data);
      return response.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries(['players']);
      queryClient.invalidateQueries(['players', id]);
    }
  });
};

export const useDeletePlayer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      await api.players.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['players']);
    }
  });
};

// Auth hooks
export const useLogin = () => {
  return useMutation({
    mutationFn: async ({ email, password }) => {
      const response = await api.auth.login(email, password);
      return response.data;
    }
  });
};

export const useRegister = () => {
  return useMutation({
    mutationFn: async ({ email, password, role, company_id }) => {
      const response = await api.auth.register(email, password, role, company_id);
      return response.data;
    }
  });
};

export const useResetPassword = () => {
  return useMutation({
    mutationFn: async (email) => {
      const response = await api.auth.resetPassword(email);
      return response.data;
    }
  });
};

export const useVerifyToken = () => {
  return useQuery({
    queryKey: ['auth', 'verify'],
    queryFn: async () => {
      const response = await api.auth.verifyToken();
      return response.data;
    }
  });
};

// Profile operations
export const useCreateProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const response = await api.profiles.create(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['user']);
    }
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }) => {
      const response = await api.profiles.update(id, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['user']);
    }
  });
}; 