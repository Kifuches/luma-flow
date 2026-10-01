import { Component, computed, effect, signal } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import {
  chevronBackOutline,
  chevronForwardOutline,
  closeOutline,
  settingsOutline,
} from 'ionicons/icons';
import { addIcons } from 'ionicons';

type CalendarDay = {
  key: string;
  day: number;
  isToday: boolean;
  isPeriod: boolean;
  isPredictedPeriod: boolean;
};

type CalendarMonth = {
  id: string;
  title: string;
  year: number;
  weeks: (CalendarDay | null)[][];
};

const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

const WEEK_DAYS = ['П', 'В', 'С', 'Ч', 'П', 'С', 'В'];
const PERIOD_STORAGE_KEY = 'luma-flow.period-days';
const DAY_MS = 24 * 60 * 60 * 1000;

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonSegment,
    IonSegmentButton,
    IonTitle,
    IonToolbar,
  ],
})
export class HomePage {
  readonly weekDays = WEEK_DAYS;
  readonly viewMode = signal<'month' | 'year'>('month');
  readonly visibleMonth = signal(startOfMonth(new Date()));
  readonly periodDays = signal<Set<string>>(loadPeriodDays());

  readonly calendarMonths = computed(() => {
    const center = this.visibleMonth();
    const offsets = this.viewMode() === 'month' ? [0] : Array.from({ length: 12 }, (_, index) => index - center.getMonth());

    return offsets.map((offset) => this.buildMonth(addMonths(center, offset)));
  });

  readonly navigationLabel = computed(() => {
    const month = this.visibleMonth();

    return this.viewMode() === 'month' ? `${MONTHS[month.getMonth()]} ${month.getFullYear()}` : `${month.getFullYear()}`;
  });

  readonly selectedPeriodCount = computed(() => this.periodDays().size);

  constructor() {
    addIcons({
      chevronBackOutline,
      chevronForwardOutline,
      closeOutline,
      settingsOutline,
    });

    effect(() => {
      localStorage.setItem(PERIOD_STORAGE_KEY, JSON.stringify([...this.periodDays()]));
    });
  }

  setViewMode(value: number | string | null | undefined): void {
    if (value === 'month' || value === 'year') {
      this.viewMode.set(value);
    }
  }

  goToPreviousPeriod(): void {
    this.visibleMonth.update((month) => addMonths(month, this.viewMode() === 'month' ? -1 : -12));
  }

  goToNextPeriod(): void {
    this.visibleMonth.update((month) => addMonths(month, this.viewMode() === 'month' ? 1 : 12));
  }

  goToToday(): void {
    this.visibleMonth.set(startOfMonth(new Date()));
  }

  togglePeriodDay(day: CalendarDay): void {
    this.periodDays.update((days) => {
      const nextDays = new Set(days);

      if (nextDays.has(day.key)) {
        nextDays.delete(day.key);
      } else {
        nextDays.add(day.key);
      }

      return nextDays;
    });
  }

  private buildMonth(month: Date): CalendarMonth {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const leadingBlanks = mondayBasedWeekday(new Date(year, monthIndex, 1));
    const cells: (CalendarDay | null)[] = Array.from({ length: leadingBlanks }, () => null);

    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = toDateKey(new Date(year, monthIndex, day));

      cells.push({
        key,
        day,
        isToday: key === toDateKey(new Date()),
        isPeriod: this.periodDays().has(key),
        isPredictedPeriod: this.isPredictedPeriodDay(key),
      });
    }

    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    return {
      id: `${year}-${monthIndex}`,
      title: MONTHS[monthIndex],
      year,
      weeks: chunkWeeks(cells),
    };
  }

  private isPredictedPeriodDay(key: string): boolean {
    if (this.periodDays().has(key)) {
      return false;
    }

    const selectedDays = [...this.periodDays()].sort();
    const lastPeriodDay = selectedDays.at(-1);

    if (!lastPeriodDay) {
      return false;
    }

    const predictedStart = addDays(fromDateKey(lastPeriodDay), 28);
    const date = fromDateKey(key);
    const diff = Math.round((date.getTime() - predictedStart.getTime()) / DAY_MS);

    return diff >= 0 && diff < 5;
  }
}

function loadPeriodDays(): Set<string> {
  try {
    const storedValue = localStorage.getItem(PERIOD_STORAGE_KEY);
    const parsedValue = storedValue ? (JSON.parse(storedValue) as unknown) : [];

    return new Set(Array.isArray(parsedValue) ? parsedValue.filter((value): value is string => typeof value === 'string') : []);
  } catch {
    return new Set();
  }
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function addDays(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

function mondayBasedWeekday(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function fromDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);

  return new Date(year, month - 1, day);
}

function chunkWeeks(cells: (CalendarDay | null)[]): (CalendarDay | null)[][] {
  const weeks: (CalendarDay | null)[][] = [];

  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }

  return weeks;
}
