import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { CityDropdown } from '../models/city/city-dropdown.module';

@Injectable({
  providedIn: 'root'
})
export class CityService {
  private apiUrl = environment.apiUrl; 


  constructor(private http: HttpClient) { }

  getCities() {
    const url = `${this.apiUrl}/cities`;
    return this.http.get<CityDropdown[]>(url);

  }
 getCity(name: string) {
  const url = `${this.apiUrl}/city`;
  return this.http.get<CityDropdown>(url, { params: { name } });
}

}
