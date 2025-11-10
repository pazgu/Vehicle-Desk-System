import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { delay, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export type GuidelineItem = { id: string; text: string; };
export type GuidelinesDoc = {
  title: string;
  updated_at: string; // ISO
  items: GuidelineItem[];
};

@Injectable({ providedIn: 'root' })
export class GuidelinesService {
  private baseUrl = environment.apiUrl || '/api';
  private useMock = true; // flip to false when backend is ready

  private readonly LS_KEY = 'bookit.guidelines';
  private _doc$ = new BehaviorSubject<GuidelinesDoc | null>(null);
  doc$ = this._doc$.asObservable();

  constructor(private http: HttpClient) {
    const existing = this.loadFromLocal();
    if (!existing) {
      const seed: GuidelinesDoc = {
        title: 'הנחיות שימוש ברכב',
        updated_at: new Date().toISOString(),
        items: [
          { id: crypto.randomUUID(), text: 'הנסיעה מותרת לשימוש עובד/ת בלבד מעל גיל 18.' },
          { id: crypto.randomUUID(), text: 'יש להחזיר את הרכב בזמן, נקי, ובדלק/טעינה כנדרש.' },
          { id: crypto.randomUUID(), text: 'חל איסור להסיע נוסעים ללא אישור מנהל.' },
          { id: crypto.randomUUID(), text: 'כל עבירת תנועה באחריות הנהג/ת.' },
          { id: crypto.randomUUID(), text: 'במקרה תקלה/תאונה יש לדווח מיד למנהל המערכת.' },
        ],
      };
      this.saveToLocal(seed);
      this._doc$.next(seed);
    } else {
      this._doc$.next(existing);
    }
  }

  get(): Observable<GuidelinesDoc> {
    if (this.useMock) return of(this._doc$.value!).pipe(delay(150));
    return this.http.get<GuidelinesDoc>(`${this.baseUrl}/guidelines`).pipe(
      tap(doc => this._doc$.next(doc))
    );
  }

  save(doc: GuidelinesDoc): Observable<GuidelinesDoc> {
    const updated: GuidelinesDoc = { ...doc, updated_at: new Date().toISOString() };
    if (this.useMock) {
      this.saveToLocal(updated);
      this._doc$.next(updated);
      return of(updated).pipe(delay(250));
    }
    return this.http.put<GuidelinesDoc>(`${this.baseUrl}/guidelines`, updated).pipe(
      tap(d => this._doc$.next(d))
    );
  }

  private loadFromLocal(): GuidelinesDoc | null {
    try { return JSON.parse(localStorage.getItem(this.LS_KEY) || 'null'); } catch { return null; }
  }
  private saveToLocal(doc: GuidelinesDoc) {
    localStorage.setItem(this.LS_KEY, JSON.stringify(doc));
  }
}
