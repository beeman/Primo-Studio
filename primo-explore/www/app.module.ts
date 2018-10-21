import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';
import {HttpClientModule} from "@angular/common/http";
import {RouterModule, Routes} from "@angular/router";
import {CookieService} from 'ngx-cookie-service';
import {FormlyModule} from "@ngx-formly/core";
import {FormlyMaterialModule} from "@ngx-formly/material";
import {MatDialogModule, MatTooltipModule} from "@angular/material";
import {Angulartics2Module, RouterlessTracking} from "angulartics2";
import {Angulartics2GoogleAnalytics} from "angulartics2/ga";

import {AppComponent} from './app/app.component';
import {ConfigurationService} from "./utils/configuration.service";
import {FileUploaderService} from "./utils/file-uploader.service";
import {IframeService} from "./utils/iframe.service";
import {FeaturesService} from "./utils/features.service";
import {ServerComponent} from './server/server.component';
import {ConfigurationFormComponent} from './configuration-form/configuration-form.component';
import {OneTimeBindingDirective} from './utils/one-time-binding.directive';
import {ColorThemeComponent} from './color-theme/color-theme.component';
import {BusySpinnerComponent} from './busy-spinner/busy-spinner.component';
import {EditImagesComponent} from './edit-images/edit-images.component';
import {FeaturesListComponent} from './features-list/features-list.component';
import {FeatureConfigurationFormComponent} from './feature-configuration-form/feature-configuration-form.component';
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import { EditorTabComponent } from './editor-tab/editor-tab.component';
import {EditorService} from "./editor-tab/editor.service";
import {CodemirrorModule} from "ng2-codemirror";
import { CodeEditorComponent } from './code-editor/code-editor.component';
import {FormsModule} from "@angular/forms";
import { DownloadPackageComponent } from './download-package/download-package.component';
import { UploadPackageComponent } from './upload-package/upload-package.component';
import { FileTreeComponent } from './file-tree/file-tree.component';
import { SplitPathPipe } from './file-tree/split-path.pipe';
import { SliceCustomizationPathPipe } from './file-tree/slice-customization-path.pipe';
import { AddClassToChildrenDirective } from './utils/add-class-to-children.directive';
import { IconsPickerComponent } from './icons-picker/icons-picker.component';
import {IconsPickerService} from "./icons-picker/icons-picker.service";
import { CalcSVGViewBoxDirective } from './utils/calc-view-box.directive';
import { IconPickerDialogComponent } from './icon-picker-dialog/icon-picker-dialog.component';
import { SearchIconPipe } from './icon-picker-dialog/search-icon.pipe';


const appRoutes: Routes = [
  {path: '', component: ServerComponent, pathMatch: 'full'},
  {path: '*', redirectTo: ''}
];

@NgModule({
  declarations: [
    AppComponent,
    ServerComponent,
    ConfigurationFormComponent,
    OneTimeBindingDirective,
    ColorThemeComponent,
    BusySpinnerComponent,
    EditImagesComponent,
    FeaturesListComponent,
    FeatureConfigurationFormComponent,
    EditorTabComponent,
    CodeEditorComponent,
    DownloadPackageComponent,
    UploadPackageComponent,
    FileTreeComponent,
    SplitPathPipe,
    SliceCustomizationPathPipe,
    AddClassToChildrenDirective,
    IconsPickerComponent,
    CalcSVGViewBoxDirective,
    IconPickerDialogComponent,
    SearchIconPipe
  ],
  entryComponents: [
    FeatureConfigurationFormComponent,
    IconPickerDialogComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    FormsModule,
    Angulartics2Module.forRoot([Angulartics2GoogleAnalytics], {
      pageTracking: {
        clearQueryParams: false
      }
    }),
    RouterModule.forRoot(appRoutes, {
      scrollPositionRestoration: "top",
      anchorScrolling: "enabled"
    }),
    FormlyModule.forRoot(),
    FormlyMaterialModule,
    BrowserAnimationsModule,
    MatDialogModule,
    MatTooltipModule,
    CodemirrorModule
  ],
  providers: [
    CookieService,
    ConfigurationService,
    FileUploaderService,
    IframeService,
    FeaturesService,
    RouterlessTracking,
    EditorService,
    IconsPickerService
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
