import { Injectable } from '@angular/core';
import Swal, { SweetAlertIcon, SweetAlertResult } from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class SweetAlertService {

  public showAlert(
    title: string,
    message: string,
    icon: SweetAlertIcon = 'info'
  ): Promise<SweetAlertResult> {
    return Swal.fire({
      title: title,
      text: message,
      icon: icon,
      confirmButtonColor: '#3085d6',
      confirmButtonText: 'OK'
    });
  }

  public confirm(
    title: string,
    message: string,
    confirmText: string = 'Yes',
    cancelText: string = 'Cancel'
  ): Promise<SweetAlertResult> {
    return Swal.fire({
      title: title,
      text: message,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: confirmText,
      cancelButtonText: cancelText
    });
  }

  html(
    title: string,
    htmlContent: string,
    icon: SweetAlertIcon = 'info'
  ): Promise<SweetAlertResult> {
    return Swal.fire({
      title: title,
      html: htmlContent,
      icon: icon,
      confirmButtonColor: '#3085d6'
    });
  }

  public loading(title: string = 'Loading...'): void {
    Swal.fire({
      title: title,
      allowEscapeKey: false,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
  }

  public toast(
    message: string,
    icon: SweetAlertIcon = 'success',
    position: 'top' | 'top-start' | 'top-end' | 'center' | 'center-start' | 'center-end' | 'bottom' | 'bottom-start' | 'bottom-end' = 'top-end',
    timer: number = 3000
  ): void {
    Swal.fire({
      toast: true,
      position: position,
      icon: icon,
      title: message,
      showConfirmButton: false,
      timer: timer,
      timerProgressBar: true
    });
  }
}