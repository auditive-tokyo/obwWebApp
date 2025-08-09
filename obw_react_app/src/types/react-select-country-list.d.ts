declare module 'react-select-country-list' {
  interface CountryOption {
    value: string
    label: string
  }
  interface CountryList {
    getData: () => CountryOption[]
  }
  const countryList: () => CountryList
  export default countryList
}