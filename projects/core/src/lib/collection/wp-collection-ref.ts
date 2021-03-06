import { BehaviorSubject, Observable, Subject, of, forkJoin } from 'rxjs';
import { catchError, distinctUntilChanged, filter, first, map, switchMap } from 'rxjs/operators';
import { WpCollectionState, WpPagination, WpQuery } from './wp-collection.interface';
import { WpCollectionService } from './wp-collection.service';
import { WpConfig } from '../interfaces';
import { mergeDeep, filterModel } from '../utilities';

export const defaultCollectionState: WpCollectionState = {
  data: [],
  loading: false,
  error: null,
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalObjects: 0,
    hasPrev: false,
    hasMore: false
  },
};

export class WpCollectionRef {

  /**
   * Request URL
   */
  private _url: string;

  /**
   * WpCollection query
   */
  private _query: WpQuery = {
    page: 1,
    per_page: 6,
    _embed: true
  };

  /**
   * Stream that emits WpCollection state
   */
  private _state = new BehaviorSubject<WpCollectionState>({ ...defaultCollectionState});
  state = this._state.asObservable();

  /**
   * Stream that emits WpCollection loading state
   */
  get loading(): Observable<boolean> {
    return this.state.pipe(
      map((state: WpCollectionState) => state.loading),
      distinctUntilChanged()
    );
  }

  /**
   * Stream that emits WpCollection data
   */
  get data(): Observable<any[]> {
    return this.state.pipe(
      map((state: WpCollectionState) => state.data),
      filter(data => !!data),
      distinctUntilChanged()
    );
  }

  /**
   * Stream that emits WpCollection pagination
   */
  get pagination(): Observable<WpPagination> {
    return this.state.pipe(
      map((state: WpCollectionState) => state.pagination),
      distinctUntilChanged()
    );
  }

  /**
   * Stream that emits WpCollection errors
   */
  get error(): Observable<Error> {
    return this.state.pipe(
      map((state: WpCollectionState) => state.error),
      filter(error => !!error),
      distinctUntilChanged()
    );
  }

  constructor(private collection: WpCollectionService,
              private config: WpConfig,
              private endpoint: string,
              private errorEmitter: Subject<Error>,
              query: WpQuery) {
    this._url = config.baseUrl + config.restUrl + endpoint;
    this._query = {...this._query, ...query};
  }

  /**
   * Get a collection of items
   */
  get(query?: WpQuery): Observable<WpCollectionState> {
    this._query = {...this._query, ...{page: 1}, ...query};
    return this._fetch();
  }

  /**
   * Get next page of the collection combined with current collection
   */
  more(): Observable<WpCollectionState> {
    return this.state.pipe(
      first(),
      filter((state: WpCollectionState) => state.pagination.hasMore),
      switchMap((state: WpCollectionState) => {
        /** increment currentPage then set page argument */
        const page = state.pagination.currentPage + 1;
        this._query = {...this._query, ...{page}};
        return this._fetch(state.data);
      }),
    );
  }

  /**
   * Get next page of the collection
   */
  next(): Observable<WpCollectionState> {
    return this.state.pipe(
      first(),
      filter((state: WpCollectionState) => state.pagination.hasMore),
      switchMap((state: WpCollectionState) => {
        /** increment currentPage then set page argument */
        const page = state.pagination.currentPage + 1;
        this._query = {...this._query, ...{page}};
        return this._fetch();
      }),
    );
  }

  /**
   * Get prev page of the collection
   */
  prev(): Observable<WpCollectionState> {
    return this.state.pipe(
      first(),
      filter((state: WpCollectionState) => state.pagination.hasPrev),
      switchMap((state: WpCollectionState) => {
        /** decrement currentPage then set page argument */
        const page = state.pagination.currentPage - 1;
        this._query = {...this._query, ...{page}};
        return this._fetch();
      }),
    );
  }

  /**
   * Destroy state
   */
  destroy() {
    this._state.complete();
  }

  /**
   * Fetch data from wp api
   */
  private _fetch(mergeData = []): Observable<WpCollectionState> {
    this._updateState({loading: true});

    return this.collection.get(this._url, this._query).pipe(
      switchMap((res: WpCollectionState) => this._onSuccess(res, mergeData)),
      catchError((err: Error) => this._onError(err))
    );
  }

  /**
   * Data fetch success
   */
  private _onSuccess(res: WpCollectionState, currDataArr?: any[]): Observable<WpCollectionState> {
    // Get the filters of the selected endpoint
    const filters = this.config.filters[this.endpoint];
    return of(res.data).pipe(
      // Filter data values in parallel
      switchMap((dataArr: any[]) =>
        forkJoin(dataArr.map((data: any) => filterModel({...data}, filters)))
      ),
      map((dataArr: any[]) =>
        this._updateState({
          pagination: res.pagination,
          data: [...currDataArr, ...dataArr],
          loading: false,
          error: null
        })
      )
    );
  }

  /**
   * Error handling
   */
  private _onError(err): Observable<WpCollectionState> {
    const state = this._updateState({
      error: err,
      loading: false
    });
    this.errorEmitter.next(err);
    return of(state);
  }

  /**
   * Update local state
   */
  private _updateState(state: WpCollectionState): WpCollectionState {
    this._state.next(mergeDeep(this._state.value, state));
    return this._state.value;
  }

}
