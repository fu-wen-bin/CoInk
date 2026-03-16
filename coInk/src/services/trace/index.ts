import request, { ErrorHandler } from '../request';
import { AnalyticsData, GetTraceParams } from './types';

export const TraceApi = {
  getTraceList: (params: GetTraceParams, errorHandler?: ErrorHandler) =>
    request.get<AnalyticsData>('/trace/analytics', {
      errorHandler,
      params,
    }),
};
