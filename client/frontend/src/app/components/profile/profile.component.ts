import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService, User } from '../../services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  currentUser: User | null = null;
  profileForm: FormGroup;
  errorMessage = '';
  successMessage = '';

  constructor(
    private authService: AuthService,
    private http: HttpClient
  ) {
    this.profileForm = new FormGroup({
      displayName: new FormControl('', [Validators.required, Validators.minLength(2)]),
      zone: new FormControl(''),
      password: new FormControl(''),
      confirmPassword: new FormControl('')
    });
  }

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUserValue();
    if (this.currentUser) {
      this.profileForm.patchValue({
        displayName: this.currentUser.display_name,
        zone: this.currentUser.zone || ''
      });
    }
  }

  getAuthHeaders() {
    return this.authService.getAuthHeaders();
  }

  updateProfile(): void {
    if (!this.profileForm.valid) return;
    const v = this.profileForm.value;
    const updates: Record<string, string> = { displayName: v.displayName, zone: v.zone || '' };
    if (v.password && v.password.length >= 6) {
      if (v.password !== v.confirmPassword) {
        this.errorMessage = 'Passwords do not match';
        return;
      }
      updates['password'] = v.password;
    }
    this.http.put('/api/users/me', updates, { headers: this.getAuthHeaders() }).subscribe({
      next: () => {
        this.successMessage = 'Profile updated successfully!';
        this.authService.getCurrentUser().subscribe(() => {
          this.currentUser = this.authService.getCurrentUserValue();
        });
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Failed to update profile';
      }
    });
  }
}
