import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-admin-inspections',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-inspections.component.html',
  styleUrls: ['./admin-inspections.component.css']
})
export class AdminInspectionsComponent implements OnInit {
  inspections: any[] = [];
  loading = true;

  constructor(private http: HttpClient, private route: ActivatedRoute
) {}

highlighted = false;

ngOnInit(): void {
  this.route.queryParams.subscribe(params => {
    this.highlighted = params['highlight'] === '1';
  });

  this.http.get<any[]>(`${environment.apiUrl}/inspections/today`).subscribe({
    next: (data) => {
      this.inspections = data;
      this.loading = false;
    },
    error: () => {
      this.loading = false;
      alert('שגיאה בטעינת בדיקות רכבים להיום');
    }
  });
}
}
