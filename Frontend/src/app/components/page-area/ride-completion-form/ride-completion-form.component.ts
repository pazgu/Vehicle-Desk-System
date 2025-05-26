import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-your-component',
  templateUrl: './ride-completion-form.component.html',
  styleUrls: ['./ride-completion-form.component.css'],
  imports: [ReactiveFormsModule,CommonModule]
})
export class RideCompletionFormComponent implements OnInit {
  form!: FormGroup;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      incident: [''],
      elaborate: ['']
    });
  }

  setIncident(value: string): void {
    this.form.get('incident')?.setValue(value);

    if (value === 'no') {
      this.form.get('elaborate')?.setValue('');
    }
  }
}
