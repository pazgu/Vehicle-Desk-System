
import { Component } from '@angular/core';
import { NgFor } from '@angular/common';
import { RouterModule } from '@angular/router';

interface User {
  name: string;
  email: string;
  role: string;
  department: string;
  
}

@Component({
  selector: 'app-user-details',
  templateUrl: './user-data.component.html',
  styleUrls: ['./user-data.component.css'],
  standalone: true,
  imports: [NgFor, RouterModule]
})
export class UserDataComponent {
  users: User[] = [
    {
      name: 'Omer Cohen',
      email: 'osher12@gmail.com',
      role: 'Supervisor',
      department: '3f67f7d5d1a4-45c2-9ae4-8b7a3c50d3fa'
      
    },
    {
      name: 'Sarah Golan',
      email: 'sg132@gmail.com',
      role: 'Employee',
      department: '3f67f7d5d1a4-45c2-9ae4-8b7a3c50d3fa'
      
    }
  ];
}

