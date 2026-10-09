//! Python binding for `rapiq-core` (PyO3), compiled as `rapiq._native`.
//!
//! JSON strings in and out, like the Node binding; the `rapiq` Python
//! package wraps this module with dict/list conversion. A failure is a
//! `RapiqError` whose args are `(code, message)`.

use pyo3::create_exception;
use pyo3::exceptions::PyException;
use pyo3::prelude::*;
use rapiq_core::api;

create_exception!(_native, RapiqError, PyException);

fn to_py(error: rapiq_core::Error) -> PyErr {
    RapiqError::new_err((error.code.as_str(), error.message))
}

/// `ExpressionFiltersParser.parse()` (schemaless): IR JSON of the root
/// group. `None` yields an empty AND group.
#[pyfunction]
#[pyo3(signature = (input=None))]
fn parse_expression_filters(input: Option<&str>) -> PyResult<String> {
    api::parse_expression_filters(input).map_err(to_py)
}

/// `ExpressionFiltersParser.parseExact()` (schemaless): IR JSON of the
/// raw expression tree.
#[pyfunction]
fn parse_expression_filters_exact(input: &str) -> PyResult<String> {
    api::parse_expression_filters_exact(input).map_err(to_py)
}

/// One-shot evaluation: does the record satisfy the filters?
#[pyfunction]
#[pyo3(signature = (filters, record, options=None))]
fn matches(filters: &str, record: &str, options: Option<&str>) -> PyResult<bool> {
    api::matches(filters, record, options).map_err(to_py)
}

/// A filter tree compiled once, evaluated many times.
#[pyclass(frozen)]
struct Predicate {
    inner: rapiq_core::Predicate,
}

#[pymethods]
impl Predicate {
    #[new]
    #[pyo3(signature = (filters, options=None))]
    fn new(filters: &str, options: Option<&str>) -> PyResult<Self> {
        let inner = api::compile(filters, options).map_err(to_py)?;

        Ok(Self { inner })
    }

    /// Test one record (JSON).
    fn test(&self, record: &str) -> PyResult<bool> {
        api::test_record(&self.inner, record).map_err(to_py)
    }

    /// Positions of the records (a JSON array) satisfying the predicate.
    fn filter_indices(&self, py: Python<'_>, records: &str) -> PyResult<Vec<u32>> {
        // evaluation touches no Python object: release the GIL.
        py.detach(|| api::matching_indices(&self.inner, records))
            .map_err(to_py)
    }
}

#[pymodule]
fn _native(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add("RapiqError", m.py().get_type::<RapiqError>())?;
    m.add_function(wrap_pyfunction!(parse_expression_filters, m)?)?;
    m.add_function(wrap_pyfunction!(parse_expression_filters_exact, m)?)?;
    m.add_function(wrap_pyfunction!(matches, m)?)?;
    m.add_class::<Predicate>()?;

    Ok(())
}
