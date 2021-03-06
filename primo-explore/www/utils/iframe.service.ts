import {Injectable} from '@angular/core';
import {ConfigurationService} from "./configuration.service";
import {DomSanitizer} from "@angular/platform-browser";
import {Observable, timer} from 'rxjs';
import {map} from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class IframeService {
  private _up: boolean;
  private _nuiIFrameElement;
  private _categorySuffix: string;

  constructor(private configurationService: ConfigurationService,
              private sanitizer: DomSanitizer) {
    this._up = false;
    this._categorySuffix = '';
  }

  get config(){
    return this.configurationService.config;
  }

  get nuiIframeElement(){
    if (!this._nuiIFrameElement){
      this._nuiIFrameElement = document.getElementById('primo-explore-iframe');
    }
    return this._nuiIFrameElement;
  }

  refreshNuiIFrame(){
    if (!this.nuiIframeElement){
      return;
    }
    this.nuiIframeElement.contentWindow.location.reload();
  }

  getIframeUrl(){
    let ve = this.configurationService.isVe;
    let appName = ve ? 'discovery' : 'primo-explore';
    if (this.config.suffix || this._categorySuffix.length) {
        let middlePart = this._categorySuffix.length ? this._categorySuffix : this.config.suffix;
        if (middlePart.indexOf('/discovery') > -1) {
            middlePart = middlePart.replace('/discovery', '');
        }
        if (middlePart.indexOf('/primo-explore') > -1) {
            middlePart = middlePart.replace('/primo-explore', '');
        }
        if (middlePart.indexOf('?') < 0) {
            middlePart = middlePart + '?';
        }
        return this.sanitizer.bypassSecurityTrustResourceUrl(window.location.protocol + '//' + window.location.host + '/' + appName + middlePart + '&vid=' + this.config.view + '&dirName=' + this.config.dirName + '&url=' + this.config.url)
    } else {
        return this.sanitizer.bypassSecurityTrustResourceUrl(window.location.protocol + '//' + window.location.host + '/' + appName + '/search/?vid=' + this.config.view + '&dirName=' + this.config.dirName + '&url=' + this.config.url);
    }
  }

  isUp(){
    return this._up;
  }

  set up(newVal){
    this._up= newVal;
  }

  set categorySuffix(suffix: string) {
      this._categorySuffix = suffix;
  }

  public isAttributesMapInitialized(): Observable<boolean> {
    return new Observable<boolean>(observer => {
      timer(0, 100)
        .pipe(map(() => (!!this.nuiIframeElement.contentWindow.appConfig) &&
                                (!!this.nuiIframeElement.contentWindow.appConfig['primo-view']) &&
                                (!!this.nuiIframeElement.contentWindow.appConfig['primo-view']['attributes-map'])))
        .subscribe(bool => {
          observer.next(bool);
            if (bool){
              observer.complete();
            }
          });
        });
    }
}
