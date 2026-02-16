import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
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
  created_at: string;
  author_name: string;
  category_name: string;
  myReactions: string[];
  reactionCounts?: Record<string, number>;
}

interface Comment {
  comment_id: number;
  post_id: number;
  author_id: number;
  body: string;
  created_at: string;
  author_name: string;
}

interface Category {
  category_id: number;
  name: string;
  description?: string;
  rules?: string;
}

@Component({
  selector: 'app-user-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, ConfirmDialogComponent],
  templateUrl: './user-dashboard.component.html',
  styleUrls: ['./user-dashboard.component.css']
})
export class UserDashboardComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  posts: Post[] = [];
  categories: Category[] = [];
  selectedPost: Post | null = null;
  postComments: Comment[] = [];
  selectedCategoryId: number | null = null;
  
  showCreatePost = false;
  showEditPost = false;
  editingPost: Post | null = null;
  editPostForm: FormGroup;
  
  createPostForm: FormGroup;
  commentForm: FormGroup;
  flagForm: FormGroup;
  showFlagModal = false;
  flagEntityType: 'post' | 'comment' | null = null;
  flagEntityId: number | null = null;
  editingComment: Comment | null = null;
  commentEditForm: FormGroup;
  viewMode: 'grid' | 'feed' = 'grid';
  hoverPostId: number | null = null;
  
  errorMessage: string = '';
  successMessage: string = '';
  private destroy$ = new Subject<void>();
  
  reactionTypes = [
    { value: 'helpful', label: '👍 Helpful' },
    { value: 'interested', label: '👀 Interested' },
    { value: 'congratulations', label: '🎉 Congratulations' },
    { value: 'sold', label: '✅ Sold' }
  ];

  constructor(
    private authService: AuthService,
    private http: HttpClient,
    private liveService: LiveService,
    private confirmService: ConfirmService
  ) {
    this.createPostForm = new FormGroup({
      title: new FormControl('', [Validators.required]),
      description: new FormControl('', [Validators.required]),
      categoryId: new FormControl('', [Validators.required]),
      zone: new FormControl('', [Validators.required]),
      price: new FormControl(null)
    });

    this.editPostForm = new FormGroup({
      title: new FormControl('', [Validators.required]),
      description: new FormControl('', [Validators.required]),
      zone: new FormControl('', [Validators.required]),
      price: new FormControl(null)
    });

    this.commentForm = new FormGroup({
      body: new FormControl('', [Validators.required])
    });
    this.flagForm = new FormGroup({
      reason: new FormControl('', [Validators.required]),
      details: new FormControl('')
    });
    this.commentEditForm = new FormGroup({
      body: new FormControl('', [Validators.required])
    });
    const savedView = localStorage.getItem('postsViewMode');
    if (savedView === 'feed' || savedView === 'grid') this.viewMode = savedView;
  }

  get selectedCategoryRules(): string | null {
    const id = this.createPostForm?.get('categoryId')?.value;
    if (!id) return null;
    const cat = this.categories.find(c => c.category_id === +id);
    return cat?.rules ?? null;
  }

  setViewMode(mode: 'grid' | 'feed'): void {
    this.viewMode = mode;
    localStorage.setItem('postsViewMode', mode);
  }

  isOwnComment(comment: Comment): boolean {
    return this.currentUser?.user_id === comment.author_id;
  }

  openEditComment(comment: Comment): void {
    this.editingComment = comment;
    this.commentEditForm.patchValue({ body: comment.body });
  }

  cancelEditComment(): void {
    this.editingComment = null;
  }

  saveEditComment(): void {
    if (!this.commentEditForm.valid || !this.selectedPost || !this.editingComment) return;
    const body = this.commentEditForm.value.body;
    this.http.put(`/api/posts/${this.selectedPost.post_id}/comments/${this.editingComment.comment_id}`, { body }, { headers: this.getAuthHeaders() }).subscribe({
      next: () => { this.showSuccess('Comment updated'); this.editingComment = null; this.viewPost(this.selectedPost!); },
      error: (err) => this.showError(err.error?.message || 'Failed to update comment')
    });
  }

  deleteComment(comment: Comment): void {
    if (!this.selectedPost) return;
    this.confirmService.show({ title: 'Delete comment', message: 'Delete this comment?', confirmText: 'Delete', danger: true }).then((ok) => {
      if (!ok) return;
      this.http.delete(`/api/posts/${this.selectedPost!.post_id}/comments/${comment.comment_id}`, { headers: this.getAuthHeaders() }).subscribe({
        next: () => { this.showSuccess('Comment deleted'); this.viewPost(this.selectedPost!); },
        error: (err) => this.showError(err.error?.message || 'Failed to delete comment')
      });
    });
  }

  reactOnCard(post: Post, reactionType: string, event: Event): void {
    event.stopPropagation();
    this.reactToPost(post, reactionType);
  }

  openFlagModal(entityType: 'post' | 'comment', entityId: number): void {
    this.flagEntityType = entityType;
    this.flagEntityId = entityId;
    this.flagForm.reset();
    this.showFlagModal = true;
  }

  closeFlagModal(): void {
    this.showFlagModal = false;
    this.flagEntityType = null;
    this.flagEntityId = null;
  }

  submitReport(): void {
    if (!this.flagForm.valid || !this.flagEntityType || this.flagEntityId == null) return;
    const v = this.flagForm.value;
    this.http.post('/api/reports', {
      entityType: this.flagEntityType,
      entityId: this.flagEntityId,
      reason: v.reason,
      details: v.details || ''
    }, { headers: this.getAuthHeaders() }).subscribe({
      next: () => {
        this.showSuccess('Report submitted');
        this.closeFlagModal();
      },
      error: (err) => this.showError(err.error?.message || 'Failed to submit report')
    });
  }

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUserValue();
    this.liveService.connect();
    this.liveService.onPostsChanged.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.fetchPosts();
      if (this.selectedPost) this.viewPost(this.selectedPost);
    });
    this.liveService.onCategoriesChanged.pipe(takeUntil(this.destroy$)).subscribe(() => this.fetchCategories());
    this.fetchPosts();
    this.fetchCategories();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private getAuthHeaders() {
    return this.authService.getAuthHeaders();
  }

  fetchPosts(): void {
    const params: Record<string, string> = {};
    if (this.selectedCategoryId != null) params['categoryId'] = String(this.selectedCategoryId);
    this.http.get<{ content: Post[] }>('/api/posts', {
      headers: this.getAuthHeaders(),
      params
    }).subscribe({
      next: (data) => {
        this.posts = data.content || [];
      },
      error: () => this.showError('Failed to load posts')
    });
  }

  filterByCategory(categoryId: number | null): void {
    this.selectedCategoryId = categoryId;
    this.fetchPosts();
  }

  fetchCategories(): void {
    this.http.get<Category[]>('/api/categories', {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.categories = data;
      },
      error: () => {
        this.showError('Failed to load categories');
      }
    });
  }

  viewPost(post: Post): void {
    this.showEditPost = false;
    this.editingPost = null;
    this.http.get<{ comments: Comment[]; reactionCounts: Record<string, number>; myReactions: string[] } & Post>(`/api/posts/${post.post_id}`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.selectedPost = { ...post, reactionCounts: data.reactionCounts || {}, myReactions: data.myReactions || [] };
        this.postComments = data.comments || [];
      },
      error: () => this.showError('Failed to load post details')
    });
  }

  isOwnPost(post: Post): boolean {
    return this.currentUser?.user_id === post.author_id;
  }

  openEditPost(post: Post): void {
    this.editingPost = post;
    this.editPostForm.patchValue({
      title: post.title,
      description: post.description,
      zone: post.zone,
      price: post.price
    });
    this.showEditPost = true;
  }

  cancelEditPost(): void {
    this.showEditPost = false;
    this.editingPost = null;
  }

  saveEditPost(): void {
    if (!this.editPostForm.valid || !this.editingPost) return;
    const v = this.editPostForm.value;
    this.http.put(`/api/posts/${this.editingPost.post_id}`, {
      title: v.title,
      description: v.description,
      zone: v.zone,
      price: v.price ?? null
    }, { headers: this.getAuthHeaders() }).subscribe({
      next: () => {
        this.showSuccess('Post updated');
        this.cancelEditPost();
        this.fetchPosts();
        if (this.selectedPost?.post_id === this.editingPost?.post_id && this.editingPost) {
          const updated: Post = { ...this.editingPost, title: v.title, description: v.description, zone: v.zone, price: v.price != null ? Number(v.price) : null };
          this.viewPost(updated);
        }
      },
      error: (err) => this.showError(err.error?.message || 'Failed to update post')
    });
  }

  markInactive(post: Post): void {
    if (!this.isOwnPost(post)) return;
    this.confirmService.show({ title: 'Mark inactive', message: 'Mark this post as inactive? It will be hidden from the feed.', danger: true }).then((ok) => {
      if (!ok) return;
      this.http.patch(`/api/posts/${post.post_id}/inactive`, {}, { headers: this.getAuthHeaders() }).subscribe({
        next: () => { this.showSuccess('Post marked inactive'); this.closePostView(); this.fetchPosts(); },
        error: (err) => this.showError(err.error?.message || 'Failed to mark inactive')
      });
    });
  }

  reactivatePost(post: Post): void {
    this.http.patch(`/api/posts/${post.post_id}/active`, {}, { headers: this.getAuthHeaders() }).subscribe({
      next: () => { this.showSuccess('Post reactivated'); if (this.selectedPost?.post_id === post.post_id) this.viewPost(post); this.fetchPosts(); },
      error: (err) => this.showError(err.error?.message || 'Failed to reactivate')
    });
  }

  closePostView(): void {
    this.selectedPost = null;
    this.postComments = [];
    this.commentForm.reset();
  }

  createPost(): void {
    if (this.createPostForm.valid) {
      const formValue = this.createPostForm.value;
      this.http.post('/api/posts', {
        title: formValue.title,
        description: formValue.description,
        categoryId: parseInt(formValue.categoryId),
        zone: formValue.zone,
        price: formValue.price || null
      }, {
        headers: this.getAuthHeaders()
      }).subscribe({
        next: () => {
          this.showSuccess('Post created successfully!');
          this.createPostForm.reset();
          this.showCreatePost = false;
          this.fetchPosts();
        },
        error: (err) => {
          this.showError(err.error?.message || 'Failed to create post');
        }
      });
    }
  }

  addComment(): void {
    if (this.commentForm.valid && this.selectedPost) {
      this.http.post(`/api/posts/${this.selectedPost.post_id}/comments`, {
        body: this.commentForm.value.body
      }, {
        headers: this.getAuthHeaders()
      }).subscribe({
        next: () => {
          this.showSuccess('Comment added!');
          this.commentForm.reset();
          this.viewPost(this.selectedPost!);
        },
        error: (err) => {
          this.showError(err.error?.message || 'Failed to add comment');
        }
      });
    }
  }

  reactToPost(post: Post, reactionType: string): void {
    this.http.post(`/api/posts/${post.post_id}/reactions`, {
      type: reactionType
    }, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        this.fetchPosts();
        if (this.selectedPost?.post_id === post.post_id) {
          this.viewPost(post);
        }
      },
      error: (err) => {
        this.showError(err.error?.message || 'Failed to react');
      }
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
