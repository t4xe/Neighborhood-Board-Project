import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { AuthService, User } from '../../services/auth.service';
import { LiveService } from '../../services/live.service';
import { ConfirmService } from '../../services/confirm.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';

interface Post {
  post_id: number;
  author_id: number;
  category_id: number;
  title: string;
  description: string;
  price: number | null;
  zone: string;
  status: string;
  expires_at?: string | null;
  created_at: string;
  author_name: string;
  category_name: string;
}

interface Comment {
  comment_id: number;
  post_id: number;
  author_id: number;
  body: string;
  author_name: string;
  created_at: string;
}

interface Reaction {
  reaction_id: number;
  post_id: number;
  type: string;
  author_name: string;
  created_at: string;
}

interface Category {
  category_id: number;
  name: string;
  description?: string;
  rules?: string;
}

interface EntityContentPost {
  kind: 'post';
  post_id: number;
  title: string;
  description: string;
  author_id: number;
  author_name: string;
  author_email: string;
}
interface EntityContentComment {
  kind: 'comment';
  comment_id: number;
  body: string;
  author_id: number;
  author_name: string;
  author_email: string;
  post_id: number;
}
interface Report {
  report_id: number;
  reporter_id: number;
  entity_type: string;
  entity_id: number;
  reason: string;
  details: string;
  status: string;
  reporter_name: string;
  created_at: string;
  audit?: { action: string; actor_name: string; created_at: string; details: string }[];
  entity_content?: EntityContentPost | EntityContentComment;
}

interface UserListItem {
  user_id: number;
  email: string;
  display_name: string;
  roles: string;
  status: string;
  created_at: string;
  isAdmin: boolean;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ConfirmDialogComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  users: UserListItem[] = [];
  posts: Post[] = [];
  categories: Category[] = [];
  reports: Report[] = [];
  selectedUser: UserListItem | null = null;
  selectedPost: Post | null = null;
  selectedPostComments: Comment[] = [];
  selectedPostReactions: Reaction[] = [];
  selectedReport: Report | null = null;
  view: 'users' | 'posts' | 'categories' | 'reports' = 'users';
  showUserEdit = false;
  showAddCategory = false;
  showReportDetail = false;
  editingCategoryId: number | null = null;
  userEditForm: FormGroup;
  categoryForm: FormGroup;
  categoryEditForm: FormGroup;
  reportStatusForm: FormGroup;
  errorMessage = '';
  successMessage = '';
  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private http: HttpClient,
    private liveService: LiveService,
    private confirmService: ConfirmService
  ) {
    this.userEditForm = new FormGroup({
      displayName: new FormControl('', [Validators.required]),
      roles: new FormControl('', [Validators.required]),
      status: new FormControl('', [Validators.required]),
      zone: new FormControl('')
    });
    this.categoryForm = new FormGroup({
      name: new FormControl('', [Validators.required]),
      description: new FormControl(''),
      rules: new FormControl('')
    });
    this.categoryEditForm = new FormGroup({
      name: new FormControl('', [Validators.required]),
      description: new FormControl(''),
      rules: new FormControl('')
    });
    this.reportStatusForm = new FormGroup({
      status: new FormControl('', [Validators.required]),
      action: new FormControl(''),
      details: new FormControl('')
    });
  }

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUserValue();
    this.liveService.connect();
    this.liveService.onPostsChanged.pipe(takeUntil(this.destroy$)).subscribe(() => { this.fetchPosts(); if (this.selectedPost) this.viewPost(this.selectedPost); });
    this.liveService.onReportsChanged.pipe(takeUntil(this.destroy$)).subscribe(() => { this.fetchReports(); if (this.selectedReport) this.viewReport(this.selectedReport.report_id); });
    this.liveService.onCategoriesChanged.pipe(takeUntil(this.destroy$)).subscribe(() => this.fetchCategories());
    this.liveService.onUsersChanged.pipe(takeUntil(this.destroy$)).subscribe(() => this.fetchUsers());
    this.fetchUsers();
    this.fetchPosts();
    this.fetchCategories();
    this.fetchReports();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private getAuthHeaders() {
    return this.authService.getAuthHeaders();
  }

  fetchUsers(): void {
    this.http.get<UserListItem[]>('/api/users', {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.users = data;
      },
      error: (err) => {
        this.showError('Failed to load users');
      }
    });
  }

  fetchPosts(): void {
    this.http.get<{ content: Post[] }>('/api/posts/admin/all', {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => { this.posts = data.content || []; },
      error: () => this.showError('Failed to load posts')
    });
  }

  fetchCategories(): void {
    this.http.get<Category[]>('/api/categories', { headers: this.getAuthHeaders() }).subscribe({
      next: (data) => { this.categories = data; },
      error: () => this.showError('Failed to load categories')
    });
  }

  fetchReports(): void {
    this.http.get<Report[]>('/api/reports', { headers: this.getAuthHeaders() }).subscribe({
      next: (data) => { this.reports = data; },
      error: () => this.showError('Failed to load reports')
    });
  }

  viewPost(post: Post): void {
    this.selectedPost = post;
    this.http.get<{ comments: Comment[]; reactions: Reaction[] }>(`/api/posts/${post.post_id}`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.selectedPostComments = data.comments || [];
        this.selectedPostReactions = data.reactions || [];
      },
      error: () => this.showError('Failed to load post details')
    });
  }

  closePostDetail(): void {
    this.selectedPost = null;
    this.selectedPostComments = [];
    this.selectedPostReactions = [];
  }

  deleteComment(postId: number, commentId: number): void {
    this.confirmService.show({ title: 'Delete comment', message: 'Delete this comment?', confirmText: 'Delete', danger: true }).then((ok) => {
      if (!ok) return;
      this.http.delete(`/api/posts/${postId}/comments/${commentId}`, { headers: this.getAuthHeaders() }).subscribe({
        next: () => { this.showSuccess('Comment deleted'); this.viewPost(this.selectedPost!); },
        error: (e) => this.showError(e.error?.message || 'Failed to delete comment')
      });
    });
  }

  deleteReaction(postId: number, reactionId: number): void {
    this.http.delete(`/api/posts/${postId}/reactions/${reactionId}`, { headers: this.getAuthHeaders() }).subscribe({
      next: () => { this.showSuccess('Reaction removed'); this.viewPost(this.selectedPost!); },
      error: (e) => this.showError(e.error?.message || 'Failed to remove reaction')
    });
  }

  addCategory(): void {
    if (!this.categoryForm.valid) return;
    const v = this.categoryForm.value;
    this.http.post('/api/categories', { name: v.name, description: v.description, rules: v.rules }, { headers: this.getAuthHeaders() }).subscribe({
      next: () => { this.showSuccess('Category added'); this.categoryForm.reset(); this.showAddCategory = false; this.fetchCategories(); },
      error: (e) => this.showError(e.error?.message || 'Failed to add category')
    });
  }

  editCategory(cat: Category): void {
    this.editingCategoryId = cat.category_id;
    this.categoryEditForm.patchValue({ name: cat.name, description: cat.description || '', rules: cat.rules || '' });
  }

  cancelCategoryEdit(): void {
    this.editingCategoryId = null;
  }

  saveCategoryEdit(): void {
    if (!this.categoryEditForm.valid || this.editingCategoryId == null) return;
    const v = this.categoryEditForm.value;
    this.http.put(`/api/categories/${this.editingCategoryId}`, { name: v.name, description: v.description, rules: v.rules }, { headers: this.getAuthHeaders() }).subscribe({
      next: () => { this.showSuccess('Category updated'); this.editingCategoryId = null; this.fetchCategories(); },
      error: (e) => this.showError(e.error?.message || 'Failed to update category')
    });
  }

  deleteCategory(cat: Category): void {
    this.confirmService.show({ title: 'Delete category', message: `Delete category "${cat.name}"? This will fail if any posts use it.`, confirmText: 'Delete', danger: true }).then((ok) => {
      if (!ok) return;
      this.http.delete(`/api/categories/${cat.category_id}`, { headers: this.getAuthHeaders() }).subscribe({
        next: () => { this.showSuccess('Category deleted'); this.editingCategoryId = null; this.fetchCategories(); },
        error: (e) => this.showError(e.error?.message || 'Failed to delete category')
      });
    });
  }

  viewReport(reportId: number): void {
    this.http.get<Report & { audit: Report['audit']; entity_content?: Report['entity_content'] }>(`/api/reports/${reportId}`, { headers: this.getAuthHeaders() }).subscribe({
      next: (data) => { this.selectedReport = data; this.showReportDetail = true; this.reportStatusForm.patchValue({ status: data.status }); },
      error: () => this.showError('Failed to load report')
    });
  }

  deleteReportedComment(): void {
    if (!this.selectedReport?.entity_content || (this.selectedReport.entity_content as EntityContentComment).kind !== 'comment') return;
    const ec = this.selectedReport.entity_content as EntityContentComment;
    this.confirmService.show({ title: 'Delete comment', message: 'Delete this reported comment?', confirmText: 'Delete', danger: true }).then((ok) => {
      if (!ok) return;
      this.http.delete(`/api/posts/${ec.post_id}/comments/${ec.comment_id}`, { headers: this.getAuthHeaders() }).subscribe({
        next: () => { this.showSuccess('Comment deleted'); this.updateReportStatus(); this.closeReportDetail(); this.fetchReports(); },
        error: (e) => this.showError(e.error?.message || 'Failed to delete comment')
      });
    });
  }

  suspendReportedUser(): void {
    const ec = this.selectedReport?.entity_content as EntityContentPost | EntityContentComment | undefined;
    if (!ec || !('author_id' in ec)) return;
    const authorId = ec.author_id;
    this.confirmService.show({ title: 'Suspend user', message: 'Suspend this user?', confirmText: 'Suspend', danger: true }).then((ok) => {
      if (!ok) return;
      this.http.put(`/api/users/${authorId}`, { status: 'suspended' }, { headers: this.getAuthHeaders() }).subscribe({
        next: () => { this.showSuccess('User suspended'); this.fetchUsers(); },
        error: (e) => this.showError(e.error?.message || 'Failed to suspend user')
      });
    });
  }

  reactivatePost(post: Post): void {
    this.http.patch(`/api/posts/${post.post_id}/active`, {}, { headers: this.getAuthHeaders() }).subscribe({
      next: () => { this.showSuccess('Post reactivated'); this.fetchPosts(); if (this.selectedPost?.post_id === post.post_id) this.viewPost(post); },
      error: (e) => this.showError(e.error?.message || 'Failed to reactivate')
    });
  }

  closeReportDetail(): void {
    this.selectedReport = null;
    this.showReportDetail = false;
  }

  updateReportStatus(): void {
    if (!this.reportStatusForm.valid || !this.selectedReport) return;
    const v = this.reportStatusForm.value;
    this.http.patch<Report & { audit: Report['audit'] }>(`/api/reports/${this.selectedReport.report_id}/status`, { status: v.status, action: v.action, details: v.details }, { headers: this.getAuthHeaders() }).subscribe({
      next: (data) => { this.selectedReport = data; this.showSuccess('Report updated'); this.fetchReports(); },
      error: (e) => this.showError(e.error?.message || 'Failed to update report')
    });
  }

  editUser(user: UserListItem): void {
    this.selectedUser = user;
    this.userEditForm.patchValue({
      displayName: user.display_name,
      roles: user.roles,
      status: user.status,
      zone: ''
    });
    this.showUserEdit = true;
  }

  cancelUserEdit(): void {
    this.selectedUser = null;
    this.showUserEdit = false;
    this.userEditForm.reset();
  }

  updateUser(): void {
    if (this.userEditForm.valid && this.selectedUser) {
      const formValue = this.userEditForm.value;
      this.http.put(`/api/users/${this.selectedUser.user_id}`, {
        displayName: formValue.displayName,
        roles: formValue.roles,
        status: formValue.status,
        zone: formValue.zone || null
      }, {
        headers: this.getAuthHeaders()
      }).subscribe({
        next: () => {
          this.showSuccess('User updated successfully!');
          this.fetchUsers();
          this.cancelUserEdit();
        },
        error: (err) => {
          this.showError(err.error?.message || 'Failed to update user');
        }
      });
    }
  }

  deleteUser(userId: number): void {
    this.confirmService.show({ title: 'Delete user', message: 'Are you sure you want to delete this user?', confirmText: 'Delete', danger: true }).then((ok) => {
      if (!ok) return;
      this.http.delete(`/api/users/${userId}`, { headers: this.getAuthHeaders() }).subscribe({
        next: () => { this.showSuccess('User deleted successfully!'); this.fetchUsers(); },
        error: (err) => this.showError(err.error?.message || 'Failed to delete user')
      });
    });
  }

  deletePost(postId: number): void {
    this.confirmService.show({ title: 'Delete post', message: 'Are you sure you want to delete this post?', confirmText: 'Delete', danger: true }).then((ok) => {
      if (!ok) return;
      this.http.delete(`/api/posts/${postId}`, { headers: this.getAuthHeaders() }).subscribe({
        next: () => { this.showSuccess('Post deleted successfully!'); this.fetchPosts(); },
        error: (err) => this.showError(err.error?.message || 'Failed to delete post')
      });
    });
  }

  logout(): void {
    this.authService.logout();
  }

  private showError(message: string): void {
    this.errorMessage = message;
    this.successMessage = '';
    setTimeout(() => this.errorMessage = '', 5000);
  }

  private showSuccess(message: string): void {
    this.successMessage = message;
    this.errorMessage = '';
    setTimeout(() => this.successMessage = '', 5000);
  }
}
