import { computed, inject, Injectable } from '@angular/core';
import { AuthService } from '../../../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private readonly authService = inject(AuthService);

  public userInitials = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return 'U';
    
    const firstInitial = user.first_name?.[0] || '';
    const lastInitial = user.last_name?.[0] || '';
    
    if (firstInitial && lastInitial) {
      return (firstInitial + lastInitial).toUpperCase();
    } else if (user.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    
    return 'U';
  });

  // Generar color aleatorio basado en las iniciales para consistencia
  public userAvatarColor = computed(() => {
    const initials = this.userInitials();
    const colors = [
      'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
    ];
    
    if (!initials) return colors[0];
    
    // Generar índice basado en las iniciales para consistencia
    let hash = 0;
    for (let i = 0; i < initials.length; i++) {
      hash = initials.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    
    return colors[index];
  });
}