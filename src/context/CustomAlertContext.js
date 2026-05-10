import React, { createContext, useState, useContext, useCallback } from 'react';
import CustomAlert from '../components/CustomAlert';

const CustomAlertContext = createContext();

export const useAlert = () => {
  const context = useContext(CustomAlertContext);
  if (!context) {
    throw new Error('useAlert must be used within a CustomAlertProvider');
  }
  return context;
};

export const CustomAlertProvider = ({ children }) => {
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    buttons: [],
  });

  const showAlert = useCallback((title, message, type = 'info', buttons = []) => {
    setAlertConfig({
      visible: true,
      title,
      message,
      type,
      buttons,
    });
  }, []);

  const hideAlert = useCallback(() => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
  }, []);

  return (
    <CustomAlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      <CustomAlert 
        {...alertConfig} 
        onClose={hideAlert} 
      />
    </CustomAlertContext.Provider>
  );
};
