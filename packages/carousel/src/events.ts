export interface CarouselSlideChangeDetail {
  readonly carouselId: string;
  readonly index: number;
  readonly totalSlides: number;
}

export interface CarouselChangeDetail {
  readonly carouselId?: string;
}

export interface CarouselEvents extends Record<string, unknown[]> {
  slideChange: [CarouselSlideChangeDetail];
  change: [CarouselChangeDetail];
}
