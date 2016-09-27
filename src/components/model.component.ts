import {Component, Input, Output, EventEmitter, OnChanges, SimpleChange} from '@angular/core';

import {WpService} from '../service/wp.service';
import {ModelService} from '../service/model/model.service';
import {QueryArgs} from "../classes/args.model";

@Component({
  selector: 'wp-model',
  template: `<ng-content></ng-content>`
})

export class WpModel implements OnChanges {

  private model: ModelService;

  /** Inputs for api endpoint, query arguments and model id */
  @Input()
  set endpoint(endpoint: string) {
    this.model = this.wpService.model().endpoint(endpoint);
  }

  /** Model Id, the component will refresh the request on id changes */
  @Input() id: number;

  /** Model QueryArgs */
  @Input() args: QueryArgs;

  /** Output for the response */
  @Output() response = new EventEmitter();

  constructor(private wpService: WpService) {
  }

  /** Detects if args has changed to fetch again. */
  ngOnChanges(changes: {[propName: string]: SimpleChange}) {

    if (changes['id']) {
      let prevId = changes['id'].previousValue;
      let newId = changes['id'].currentValue;
      if (prevId != newId) {
        this.get(newId, this.args);
      }
    }
  }

  /** Get a model of endpoint type by id */
  public get(id, args?) {
    this.model.get(id, args).subscribe(
      (res) => {
        this.response.emit(res);
      }
    );
  }

}
