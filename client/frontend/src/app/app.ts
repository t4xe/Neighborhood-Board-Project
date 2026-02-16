import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App implements OnInit {
  isLoggedIn = false;
  posts: any[] = [];
  categories: any[] = [];

  loginForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required])
  });

  constructor(private http: HttpClient) {}

  ngOnInit() {
    const token = localStorage.getItem('token')?.trim();
    if (token) {
      this.isLoggedIn = true;
      this.fetchPosts();
      this.fetchCategories();
    }
  }

  private getAuthHeaders(): HttpHeaders | undefined {
    const token = localStorage.getItem('token')?.trim();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
  }

  onLogin() {
    if (this.loginForm.valid) {
      this.http.post('/api/authentication/login', this.loginForm.value).subscribe({
        next: (res: any) => {
	      const cleanToken = res.token.toString().trim();
          localStorage.setItem('token', cleanToken);
          this.isLoggedIn = true;
          this.fetchPosts();
          this.fetchCategories();
		  alert('Login successful!');
        },
        error: (err) => alert('Login failed!')
      });
    }
  }

  fetchPosts() {
    this.http.get<any>('/api/posts', { headers: this.getAuthHeaders() }).subscribe({
      next: data => this.posts = data.content || data,
      error: () => this.logout()
    });
  }

  fetchCategories() {
    this.http.get<any[]>('/api/categories', { headers: this.getAuthHeaders() }).subscribe({
      next: data => this.categories = data
    });
  }

  filterByCategory(categoryId: number) {
    this.http.get<any>('/api/posts', { 
      params: { categoryId: categoryId.toString() }, 
      headers: this.getAuthHeaders()
    }).subscribe({
      next: data => this.posts = data.content || data
    });
  }

  createPost(title: string, description: string, categoryId: string) {
  // 1. Token'ı alırken etrafındaki her türlü tırnak ve gizli boşluğu söküp atıyoruz
  let token = localStorage.getItem('token');
  
  if (!token) {
    alert("Oturum bulunamadı! Lütfen Sign Out yapıp tekrar giriş yapın.");
    return;
  }

  // BU SATIR ÇOK KRİTİK: 
  // replace(/['"]+/g, '') -> Başındaki sonundaki tırnakları siler
  // replace(/\s/g, '') -> İçindeki tüm gizli alt satır (\n) ve boşlukları siler
  const cleanToken = token.replace(/['"]+/g, '').replace(/\s/g, '');

  // 2. Header'ı oluştururken aradaki boşluğu manuel ve garanti bir şekilde koyuyoruz
  const authHeaderValue = 'Bearer ' + cleanToken;

  const myHeaders = new HttpHeaders({
    'Authorization': authHeaderValue,
    'Content-Type': 'application/json'
  });

  const body = {
    title: title.trim(),
    description: description.trim(),
    categoryId: Number(categoryId),
    zone: 'Downtown' //
  };

  // Konsolda kontrol et: Tek bir satırda tertemiz görünmeli
  console.log('GÖNDERİLEN HEADER:', authHeaderValue);

  this.http.post('/api/posts', body, { headers: myHeaders }).subscribe({
    next: () => {
      alert('BAŞARILI! İlanın sonunda eklendi.');
      this.fetchPosts(); // Listeyi tazele
    },
    error: (err) => {
      console.error('Hata detayı:', err);
      if (err.status === 401) {
        alert('Hala 401! Demek ki sorun login anındaki token kaydında.');
      }
    }
  });
}

  logout() {
    localStorage.removeItem('token');
    this.isLoggedIn = false;
    this.posts = [];
  }
}