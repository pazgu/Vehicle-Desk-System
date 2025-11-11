import { Component } from '@angular/core';
import { ChartModule } from 'primeng/chart';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TopNoShowUser } from '../../../models/no-show-stats.model';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService } from '../../../services/user_service';
import { StatisticsService } from '../../../services/statistics.service';
import { ToastService } from '../../../services/toast.service';
@Component({
  selector: 'no-shows',
  imports: [CommonModule, FormsModule],
  templateUrl: './no-shows.component.html',
  styleUrl: './no-shows.component.css',
})
export class NoShowsComponent {
  topNoShowUsers: TopNoShowUser[] = [];

  filterOnePlus: boolean = false;
  filterCritical: boolean = false;
  allNoShowUsers: TopNoShowUser[] = [];
  filteredNoShowUsers: TopNoShowUser[] = [];

  noShowSortOption = 'countDesc';
  selectedSortOption = 'countDesc';

  totalNoShows: number = 0;
  uniqueNoShowUsers: number = 0;
  selectedMonth = (new Date().getMonth() + 1).toString();
  selectedYear = new Date().getFullYear().toString();

  noShowFromDate?: string;
  noShowToDate?: string;
  private departmentsMap = new Map<string, string>();
  private departmentsLoaded: boolean = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private statisticsService: StatisticsService,
    private userService: UserService,
    private toastService: ToastService
  ) {}

  ngOnInit() {
    this.loadNoShowStatistics();
    this.loadDepartments();
    this.route.queryParams.subscribe((params) => {
      // Read query params if they exist, else keep defaults
      this.noShowSortOption = params['noShowSort'] || 'countAsc';
      this.selectedSortOption = params['selectedSort'] || 'countAsc';
      if (params['month']) {
        this.selectedMonth = String(+params['month']); // convert string to number
      }
      if (params['year']) {
        this.selectedYear = String(+params['year']); // convert string to number
      }
    });
  }
  updateQueryParams(params: any) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge', // keeps the other params
    });
  }
  onMonthOrYearChange() {
    this.updateQueryParams({
      month: this.selectedMonth,
      year: this.selectedYear,
    });
  }
  applyNoShowFilter() {
    let filtered = this.allNoShowUsers;

    if (this.filterOnePlus) {
      filtered = filtered.filter(
        (u) => (u.no_show_count ?? 0) >= 1 && (u.no_show_count ?? 0) <= 2
      );
    }

    if (this.filterCritical) {
      filtered = filtered.filter((u) => (u.no_show_count ?? 0) >= 3);
    }
    if (
      !['countAsc', 'countDesc', 'nameAsc', 'nameDesc'].includes(
        this.noShowSortOption
      )
    ) {
      this.noShowSortOption = 'countAsc';
    }
    this.updateQueryParams({ noShowSort: this.noShowSortOption });

    this.filteredNoShowUsers = this.sortUsers(filtered);
  }
  onFilterOnePlusChange() {
    if (this.filterOnePlus) {
      this.filterCritical = false; // Uncheck critical when one-plus is selected
    }
    this.applyNoShowFilter();
  }

  onFilterCriticalChange() {
    if (this.filterCritical) {
      this.filterOnePlus = false; // Uncheck one-plus when critical is selected
    }
    this.applyNoShowFilter();
  }
  sortUsers(users: any[]) {
    switch (this.noShowSortOption) {
      case 'countAsc':
        return users.sort((a, b) => a.no_show_count - b.no_show_count);
      case 'countDesc':
        return users.sort((a, b) => b.no_show_count - a.no_show_count);
      case 'nameAsc':
        return users.sort((a, b) => a.name.localeCompare(b.name));
      case 'nameDesc':
        return users.sort((a, b) => b.name.localeCompare(a.name));
      default:
        return users;
    }
  }
  onTableKeydown(event: KeyboardEvent, user: any): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.goToUserDetails(user.user_id);
    }
  }
  onFilterChange(type: 'onePlus' | 'critical') {
    if (type === 'onePlus' && this.filterOnePlus) {
      this.filterCritical = false;
    }
    if (type === 'critical' && this.filterCritical) {
      this.filterOnePlus = false;
    }
    this.applyNoShowFilter();
  }
  get isEmptyNoShowData(): boolean {
    return this.filteredNoShowUsers.length === 0;
  }
  goToUserDetails(userId: string) {
    this.router.navigate(['/user-card', userId]);
  }
  
  resolveDepartment(departmentId: string): string {
    return this.departmentsMap.get(departmentId) || 'מחלקה לא ידועה';
  }
  public loadDepartments(): void {
    this.userService.getDepartments().subscribe({
      next: (departments) => {
        departments.forEach((dep) => this.departmentsMap.set(dep.id, dep.name));
        this.departmentsLoaded = true;
        this.loadNoShowStatistics();
      },
      error: () => {
        this.toastService.show('אירעה שגיאה בטעינת נתוני מחלקות.', 'error');
        this.departmentsLoaded = false;
        this.loadNoShowStatistics();
      },
    });
  }
  public loadNoShowStatistics(): void {
    const formattedFromDate = this.noShowFromDate || undefined;
    const formattedToDate = this.noShowToDate || undefined;

    this.statisticsService
      .getTopNoShowUsers(formattedFromDate, formattedToDate)
      .subscribe({
        next: (noShowData) => {
          this.totalNoShows = noShowData.total_no_show_events;
          this.uniqueNoShowUsers = noShowData.unique_no_show_users;
          this.topNoShowUsers = noShowData.top_no_show_users;
          const mappedUsers = noShowData.top_no_show_users.map((user) => ({
            ...user,
            email: user.email || 'unknown@example.com',
            role: user.role || 'לא ידוע',
            employee_id: user.user_id,
            no_show_count: user.count,
          }));

          this.topNoShowUsers = mappedUsers;

          this.allNoShowUsers = mappedUsers;
          this.applyNoShowFilter(); // Apply default filter/sort
        },
        error: (err) => {
          console.error('❌ Failed to load no-show statistics:', err);
          this.toastService.show('אירעה שגיאה בטעינת נתוני אי-הגעה.', 'error');

          // Reset values on error
          this.topNoShowUsers = [];
          this.totalNoShows = 0;
          this.uniqueNoShowUsers = 0;
        },
      });
  }
}
