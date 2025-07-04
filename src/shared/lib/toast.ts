import { toast } from 'react-toastify';

// 성공 메시지
export const showSuccess = (message: string) => {
  toast.success(message, {
    position: "top-center",
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
  });
};

// 에러 메시지
export const showError = (message: string) => {
  toast.error(message, {
    position: "top-center",
    autoClose: 4000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
  });
};

// 경고 메시지
export const showWarning = (message: string) => {
  toast.warning(message, {
    position: "top-center",
    autoClose: 3500,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
  });
};

// 정보 메시지
export const showInfo = (message: string) => {
  toast.info(message, {
    position: "top-center",
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
  });
};

// 로딩 메시지 (수동으로 닫아야 함)
export const showLoading = (message: string = "처리 중...") => {
  return toast.loading(message, {
    position: "top-center",
    closeOnClick: false,
    draggable: false,
  });
};

// 로딩 메시지를 성공으로 업데이트
export const updateToSuccess = (toastId: any, message: string) => {
  toast.update(toastId, {
    render: message,
    type: "success",
    isLoading: false,
    autoClose: 3000,
    closeOnClick: true,
    draggable: true,
  });
};

// 로딩 메시지를 에러로 업데이트
export const updateToError = (toastId: any, message: string) => {
  toast.update(toastId, {
    render: message,
    type: "error",
    isLoading: false,
    autoClose: 4000,
    closeOnClick: true,
    draggable: true,
  });
};

// 특정 toast 닫기
export const dismissToast = (toastId?: any) => {
  if (toastId) {
    toast.dismiss(toastId);
  } else {
    toast.dismiss();
  }
}; 