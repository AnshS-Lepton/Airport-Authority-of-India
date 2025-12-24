import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="app-container">
      <div class="main-content">
        <router-outlet></router-outlet>
      </div>
    </div>
  `,
  styles: [`
    .app-container {
      height: 100vh;
      width: 100vw;
      overflow: hidden;
      position: fixed;
      top: 0;
      left: 0;
    }
    
    .main-content {
      width: 100%;
      padding: 0;
      overflow: hidden;
      height: 100vh;
      position: relative;
    }
  `]
})
export class AppComponent {
  title = 'GIS Demo - Drone Flight Management';
}

