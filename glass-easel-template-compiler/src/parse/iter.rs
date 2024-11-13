use super::tag::{Element, ElementKind, Node};

pub struct ChildrenIter<'a> {
    parent: &'a Element,
    cur: usize,
    cur_branch: usize,
}

impl<'a> ChildrenIter<'a> {
    pub(super) fn new(parent: &'a Element) -> Self {
        Self {
            parent,
            cur: 0,
            cur_branch: 0,
        }
    }
}

impl<'a> Iterator for ChildrenIter<'a> {
    type Item = &'a Node;

    fn next(&mut self) -> Option<Self::Item> {
        match &self.parent.kind {
            ElementKind::Normal { children, .. }
            | ElementKind::Pure { children, .. }
            | ElementKind::For { children, .. } => {
                let ret = children.get(self.cur);
                if ret.is_some() { self.cur += 1; }
                ret
            }
            ElementKind::If { branches, else_branch } => {
                let ret = loop {
                    if self.cur_branch >= branches.len() {
                        if let Some((_, children)) = else_branch {
                            let ret = children.get(self.cur);
                            if ret.is_some() { self.cur += 1; }
                            break ret;
                        }
                        break None;
                    }
                    let (_, _, children) = unsafe { branches.get_unchecked(self.cur_branch) };
                    let ret = children.get(self.cur);
                    if ret.is_some() {
                        self.cur += 1;
                        break ret;
                    }
                    self.cur_branch += 1;
                    self.cur = 0;
                };
                ret
            }
            ElementKind::TemplateRef { .. }
            | ElementKind::Include { .. }
            | ElementKind::Slot { .. } => None,
        }
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        let count = match &self.parent.kind {
            ElementKind::Normal { children, .. }
            | ElementKind::Pure { children, .. }
            | ElementKind::For { children, .. } => children.len(),
            ElementKind::If { branches, else_branch } => {
                branches.iter().map(|x| x.2.len()).sum::<usize>()
                    + else_branch.iter().map(|x| x.1.len()).sum::<usize>()
            }
            ElementKind::TemplateRef { .. }
            | ElementKind::Include { .. }
            | ElementKind::Slot { .. } => 0,
        };
        (count, Some(count))
    }
}
