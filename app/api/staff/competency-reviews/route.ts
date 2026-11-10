import { readCompetencyReviews, writeCompetencyReview } from '@/services/server/competencyReviews';

export function GET(request: Request) {
  return readCompetencyReviews(request, false);
}

export function POST(request: Request) {
  return writeCompetencyReview(request, false);
}
