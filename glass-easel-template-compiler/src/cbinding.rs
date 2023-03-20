use std::slice;

use crate::group;
use crate::parser;

#[repr(C)]
struct StrRef {
    buf: *mut u8,
    len: usize,
}

impl StrRef {
    #[no_mangle]
    pub extern "C" fn str_ref_free(self) {
        // empty
    }
}

impl Drop for StrRef {
    fn drop(&mut self) {
        unsafe {
            drop(slice::from_raw_parts_mut(self.buf, self.len));
        }
    }
}

impl<T: ToString> From<T> for StrRef {
    fn from(s: T) -> Self {
        let s = s.to_string().into_boxed_str().into_boxed_bytes();
        let len = s.len();
        Self {
            buf: Box::into_raw(s) as *mut u8,
            len,
        }
    }
}

#[repr(C)]
struct StrRefArray {
    buf: *mut StrRef,
    len: usize,
}

impl StrRefArray {
    #[no_mangle]
    pub extern "C" fn str_ref_array_free(self) {
        // empty
    }
}

impl From<Box<[StrRef]>> for StrRefArray {
    fn from(v: Box<[StrRef]>) -> Self {
        let len = v.len();
        let buf = Box::into_raw(v) as *mut StrRef;
        Self { buf, len }
    }
}

impl Drop for StrRefArray {
    fn drop(&mut self) {
        let _: Box<[StrRef]> = unsafe {
            Box::from_raw(slice::from_raw_parts_mut(self.buf, self.len) as *mut [StrRef])
        };
    }
}

#[repr(C)]
struct TmplParseResult {
    success: bool,
    message: StrRef,
    start_row: usize,
    start_col: usize,
    end_row: usize,
    end_col: usize,
}

impl TmplParseResult {
    fn ok() -> Self {
        TmplParseResult {
            success: true,
            message: "".into(),
            start_row: 0,
            start_col: 0,
            end_row: 0,
            end_col: 0,
        }
    }

    #[no_mangle]
    pub extern "C" fn tmpl_parser_result_free(self) {
        // empty
    }
}

impl From<parser::TmplParseError> for TmplParseResult {
    fn from(e: parser::TmplParseError) -> Self {
        Self {
            success: false,
            message: e.message.into(),
            start_row: e.start_pos.0,
            start_col: e.start_pos.1,
            end_row: e.end_pos.0,
            end_col: e.end_pos.1,
        }
    }
}

#[repr(C)]
struct TmplGroup {
    inner: *mut (),
}

impl TmplGroup {
    #[no_mangle]
    pub unsafe extern "C" fn tmpl_group_new() -> Self {
        Self {
            inner: Box::into_raw(Box::new(group::TmplGroup::new())) as *mut (),
        }
    }

    #[no_mangle]
    pub unsafe extern "C" fn tmpl_group_free(self) {
        // empty
    }

    unsafe fn inner(&self) -> &group::TmplGroup {
        &*(self.inner as *const group::TmplGroup)
    }

    unsafe fn inner_mut(&mut self) -> &mut group::TmplGroup {
        &mut *(self.inner as *mut group::TmplGroup)
    }

    #[no_mangle]
    pub unsafe extern "C" fn tmpl_group_add_tmpl(
        &mut self,
        path_buf: &u8,
        path_len: usize,
        content_buf: &u8,
        content_len: usize,
    ) -> TmplParseResult {
        let path = String::from_utf8_lossy(slice::from_raw_parts(path_buf, path_len));
        let content = String::from_utf8_lossy(slice::from_raw_parts(content_buf, content_len));
        match self.inner_mut().add_tmpl(&path, &content) {
            Ok(_) => TmplParseResult::ok(),
            Err(e) => TmplParseResult::from(e),
        }
    }

    #[no_mangle]
    pub unsafe extern "C" fn tmpl_group_add_script(
        &mut self,
        path_buf: &u8,
        path_len: usize,
        content_buf: &u8,
        content_len: usize,
    ) -> TmplParseResult {
        let path = String::from_utf8_lossy(slice::from_raw_parts(path_buf, path_len));
        let content = String::from_utf8_lossy(slice::from_raw_parts(content_buf, content_len));
        match self.inner_mut().add_script(&path, &content) {
            Ok(_) => TmplParseResult::ok(),
            Err(e) => TmplParseResult::from(e),
        }
    }

    #[no_mangle]
    pub unsafe extern "C" fn tmpl_group_get_direct_dependencies(
        &self,
        path_buf: &u8,
        path_len: usize,
    ) -> StrRefArray {
        let path = String::from_utf8_lossy(slice::from_raw_parts(path_buf, path_len)).to_string();
        self.inner()
            .get_direct_dependencies(&path)
            .unwrap_or_default()
            .into_iter()
            .map(|x| x.into())
            .collect::<Box<_>>()
            .into()
    }

    #[no_mangle]
    pub unsafe extern "C" fn tmpl_group_get_runtime_string(&self) -> StrRef {
        self.inner().get_runtime_string().into()
    }

    #[no_mangle]
    pub unsafe extern "C" fn tmpl_group_set_extra_runtime_script(
        &mut self,
        content_buf: &u8,
        content_len: usize,
    ) {
        let content = String::from_utf8_lossy(slice::from_raw_parts(content_buf, content_len));
        self.inner_mut().set_extra_runtime_script(&content);
    }

    #[no_mangle]
    pub unsafe extern "C" fn tmpl_group_get_tmpl_gen_object(
        &self,
        path_buf: &u8,
        path_len: usize,
    ) -> StrRef {
        let path = String::from_utf8_lossy(slice::from_raw_parts(path_buf, path_len)).to_string();
        self.inner()
            .get_tmpl_gen_object(&path)
            .unwrap_or_default()
            .into()
    }

    #[no_mangle]
    pub unsafe extern "C" fn tmpl_group_get_tmpl_gen_object_groups(&self) -> StrRef {
        self.inner()
            .get_tmpl_gen_object_groups()
            .unwrap_or_default()
            .into()
    }
}

impl Drop for TmplGroup {
    fn drop(&mut self) {
        unsafe {
            drop(&mut *(self.inner as *mut group::TmplGroup));
        }
    }
}
