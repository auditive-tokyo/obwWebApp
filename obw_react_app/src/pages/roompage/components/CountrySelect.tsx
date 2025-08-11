import Select from 'react-select'
import countryList from 'react-select-country-list'

export interface CountrySelectProps {
  value: string
  onChange: (label: string) => void
  placeholder?: string
  isClearable?: boolean
  className?: string
}

const options = countryList().getData()

export function CountrySelect({ value, onChange, placeholder = '国を選択してください', isClearable = true, className }: CountrySelectProps) {
  const selected = options.find(opt => opt.label === value) || null
  return (
    <Select
      options={options}
      value={selected}
      onChange={opt => onChange((opt as any)?.label || "")}
      className={className || 'w-full'}
      classNamePrefix="react-select"
      placeholder={placeholder}
      isClearable={isClearable}
      styles={{
        control: (base, state) => ({
          ...base,
          minHeight: 'auto',
          height: '41.59px',
          borderRadius: 8,
          borderColor: state.isFocused ? '#3B82F6' : '#D1D5DB',
          boxShadow: state.isFocused ? '0 0 0 2px rgba(59,130,246,.2)' : 'none',
          '&:hover': { borderColor: '#9CA3AF' },
        }),
        valueContainer: (base) => ({
          ...base,
          padding: '0 16px',
          height: 'auto',
        }),
        indicatorsContainer: (base) => ({
          ...base,
          height: 'auto',
        }),
        singleValue: (base) => ({
          ...base,
          fontSize: '0.75rem',
          lineHeight: '1.5rem',
        }),
        placeholder: (base) => ({
          ...base,
          fontSize: '0.75rem',
          lineHeight: '1.5rem',
          color: '#9CA3AF',
        }),
        input: (base) => ({
          ...base,
          margin: 0,
          padding: 0,
          fontSize: '0.75rem',
        }),
        clearIndicator: (base) => ({
          ...base,
          paddingTop: 0,
          paddingBottom: 0,
        }),
        dropdownIndicator: (base) => ({
          ...base,
          paddingTop: 0,
          paddingBottom: 0,
        }),
        menu: (base) => ({
          ...base,
          zIndex: 50,
        }),
      }}
    />
  )
}

export default CountrySelect
