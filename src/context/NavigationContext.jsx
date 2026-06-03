import { createContext, useContext } from "react";

const NavigationContext = createContext({});

export default NavigationContext;

export function useNavigation() {
  return useContext(NavigationContext);
}
