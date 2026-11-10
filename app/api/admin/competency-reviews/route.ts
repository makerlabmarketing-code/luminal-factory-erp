import { readCompetencyReviews, writeCompetencyReview } from '@/services/server/competencyReviews';

export function GET(request: Request) {
  return readCompetencyReviews(request, true);
}

export function POST(request: Request) {
  return writeCompetencyReview(request, true);
}
