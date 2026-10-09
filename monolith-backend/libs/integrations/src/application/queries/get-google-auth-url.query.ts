import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GoogleOauthService } from '../../infrastructure/services/google-oauth.service';

export class GetGoogleAuthUrlQuery {
  constructor(public readonly userId: string) {}
}

@QueryHandler(GetGoogleAuthUrlQuery)
export class GetGoogleAuthUrlHandler implements IQueryHandler<GetGoogleAuthUrlQuery> {
  constructor(private readonly googleOauthService: GoogleOauthService) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async execute(query: GetGoogleAuthUrlQuery): Promise<string> {
    return this.googleOauthService.getAuthUrl(query.userId);
  }
}
